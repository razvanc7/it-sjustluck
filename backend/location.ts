import express, { Request, Response, NextFunction } from "express";
import pkg from "pg";
import jwt from "jsonwebtoken";
import pool from "./db";

const { Pool } = pkg;
const router = express.Router();

const JWT_SECRET = "secret_key";

interface AuthenticatedRequest extends Request {
  userId?: number;
}

const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ error: "Access denied. No token provided." });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token." });
    req.userId = (user as { id: number }).id;
    next();
  });
};

const AVERAGE_STEP_LENGTH = 0.7;

const isPointInPolygon = (point: { latitude: number; longitude: number }, polygon: Array<{ latitude: number; longitude: number }>) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude;
    const yi = polygon[i].longitude;
    const xj = polygon[j].latitude;
    const yj = polygon[j].longitude;

    const intersect = ((yi > point.longitude) !== (yj > point.longitude)) &&
      (point.latitude < (xj - xi) * (point.longitude - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const earthRadius = 6371e3;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const deltaLat = (lat2 - lat1) * Math.PI / 180;
  const deltaLon = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
};

const calculateSteps = (distanceInMeters: number) => {
  return Math.round(distanceInMeters / AVERAGE_STEP_LENGTH);
};

router.post("/start-session", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const user_id = req.userId;

  try {
    const result = await pool.query(
      `INSERT INTO tracking_sessions (user_id, start_time, is_active) 
       VALUES ($1, NOW(), true) 
       RETURNING id, start_time`,
      [user_id]
    );

    res.status(201).json({ 
      sessionId: result.rows[0].id,
      startTime: result.rows[0].start_time
    });
  } catch (err: any) {
    console.error("Error starting session:", err);
    res.status(500).json({ error: "Server error starting tracking session." });
  }
});

router.post("/track", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const user_id = req.userId;
  const { sessionId, latitude, longitude, neighborhoods } = req.body;

  if (!sessionId || !latitude || !longitude) {
    return res.status(400).json({ error: "Session ID, latitude, and longitude are required." });
  }

  try {
    const sessionCheck = await pool.query(
      "SELECT id FROM tracking_sessions WHERE id = $1 AND user_id = $2 AND is_active = true",
      [sessionId, user_id]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: "Active session not found." });
    }

    const lastLocation = await pool.query(
      `SELECT latitude, longitude FROM location_points 
       WHERE session_id = $1 
       ORDER BY timestamp DESC 
       LIMIT 1`,
      [sessionId]
    );

    let distance = 0;
    let neighborhoodId = null;

    if (lastLocation.rows.length > 0) {
      const last = lastLocation.rows[0];
      distance = calculateDistance(last.latitude, last.longitude, latitude, longitude);

      if (neighborhoods && Array.isArray(neighborhoods)) {
        const point = { latitude, longitude };
        for (const neighborhood of neighborhoods) {
          if (isPointInPolygon(point, neighborhood.coordinates)) {
            neighborhoodId = neighborhood.id;
            break;
          }
        }
      }
    }

    await pool.query(
      `INSERT INTO location_points (session_id, latitude, longitude, timestamp) 
       VALUES ($1, $2, $3, NOW())`,
      [sessionId, latitude, longitude]
    );

    const steps = calculateSteps(distance);
    await pool.query(
      `UPDATE tracking_sessions 
       SET total_distance = total_distance + $1,
           total_steps = total_steps + $2
       WHERE id = $3`,
      [distance, steps, sessionId]
    );

    if (neighborhoodId) {
      await pool.query(
        `INSERT INTO neighborhood_visits (session_id, neighborhood_id, steps)
         VALUES ($1, $2, $3)
         ON CONFLICT (session_id, neighborhood_id) 
         DO UPDATE SET steps = neighborhood_visits.steps + $3`,
        [sessionId, neighborhoodId, steps]
      );
    }

    res.json({ 
      success: true, 
      distance, 
      steps,
      neighborhoodId 
    });
  } catch (err: any) {
    console.error("Error tracking location:", err);
    res.status(500).json({ error: "Server error tracking location." });
  }
});

router.post("/stop-session", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const user_id = req.userId;
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required." });
  }

  try {
    const result = await pool.query(
      `UPDATE tracking_sessions 
       SET is_active = false, end_time = NOW()
       WHERE id = $1 AND user_id = $2 AND is_active = true
       RETURNING id, start_time, end_time, total_distance, total_steps`,
      [sessionId, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Active session not found." });
    }

    const neighborhoods = await pool.query(
      `SELECT neighborhood_id, steps 
       FROM neighborhood_visits 
       WHERE session_id = $1`,
      [sessionId]
    );

    res.json({
      session: result.rows[0],
      neighborhoods: neighborhoods.rows
    });
  } catch (err: any) {
    console.error("Error stopping session:", err);
    res.status(500).json({ error: "Server error stopping session." });
  }
});

router.get("/session/:sessionId/route", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const user_id = req.userId;
  const sessionId = parseInt(req.params.sessionId);

  try {
    const sessionCheck = await pool.query(
      "SELECT id FROM tracking_sessions WHERE id = $1 AND user_id = $2",
      [sessionId, user_id]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: "Session not found." });
    }

    const route = await pool.query(
      `SELECT latitude, longitude, timestamp 
       FROM location_points 
       WHERE session_id = $1 
       ORDER BY timestamp ASC`,
      [sessionId]
    );

    res.json(route.rows);
  } catch (err: any) {
    console.error("Error fetching route:", err);
    res.status(500).json({ error: "Server error fetching route." });
  }
});

router.get("/history", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const user_id = req.userId;

  try {
    const sessions = await pool.query(
      `SELECT id, start_time, end_time, total_distance, total_steps, is_active
       FROM tracking_sessions 
       WHERE user_id = $1 
       ORDER BY start_time DESC
       LIMIT 50`,
      [user_id]
    );

    res.json(sessions.rows);
  } catch (err: any) {
    console.error("Error fetching history:", err);
    res.status(500).json({ error: "Server error fetching history." });
  }
});

export default router;