import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import pool from "./db";

const router = express.Router();
const JWT_SECRET = "secret_key";

interface AuthenticatedRequest extends Request {
  userId?: number;
}

// ADD 'export' keyword
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ error: "No token." });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token." });
    req.userId = (user as { id: number }).id;
    next();
  });
};

const AVERAGE_STEP_LENGTH = 0.7;

// --- Helper Functions ---
const isPointInPolygon = (point: { latitude: number; longitude: number }, polygon: Array<{ latitude: number; longitude: number }>) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude; const yi = polygon[i].longitude;
    const xj = polygon[j].latitude; const yj = polygon[j].longitude;
    const intersect = ((yi > point.longitude) !== (yj > point.longitude)) &&
      (point.latitude < (xj - xi) * (point.longitude - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth radius meters
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculateSteps = (distanceInMeters: number) => Math.round(distanceInMeters / AVERAGE_STEP_LENGTH);

// Award achievement helper
const awardAchievement = async (userId: number, code: string, meta: object | null = null) => {
  try {
    // find achievement id
    const aRes = await pool.query('SELECT id, title FROM achievements WHERE code = $1', [code]);
    if (aRes.rows.length === 0) return;
    const achId = aRes.rows[0].id;
    const title = aRes.rows[0].title || 'Achievement';

    // insert into user_achievements if not exists
    await pool.query(
      `INSERT INTO user_achievements (user_id, achievement_id, meta)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, achievement_id) DO NOTHING`,
      [userId, achId, meta ? JSON.stringify(meta) : null]
    );

    // create a notification for the user
    const message = `You've earned an achievement: ${title}`;
    await pool.query(
      `INSERT INTO notifications (user_id, actor_id, neighborhood_id, message, is_read, created_at)
       VALUES ($1, $2, $3, $4, false, NOW())`,
      [userId, userId, null, message]
    );
  } catch (err) {
    console.error('awardAchievement error', err);
  }
};

// --- Routes ---

// Get current map State (Owners)
router.get("/map-state", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        no.neighborhood_id, 
        no.max_steps, 
        u.color as owner_color,
        u.name as owner_name,
        no.captured_at
      FROM neighborhood_ownership no
      JOIN users u ON no.user_id = u.id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching map state:", err);
    res.status(500).json({ error: "Map state error" });
  }
});

// Get neighborhood details by id
router.get('/neighborhood/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const nid = req.params.id;
  try {
    const result = await pool.query(`
      SELECT no.neighborhood_id, no.max_steps, no.captured_at, u.id as owner_id, u.name as owner_name, u.color as owner_color
      FROM neighborhood_ownership no
      JOIN users u ON no.user_id = u.id
      WHERE no.neighborhood_id = $1
    `, [nid]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No ownership record' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching neighborhood details:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Start Session
router.post("/start-session", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const user_id = req.userId;
  try {
    const result = await pool.query(
      `INSERT INTO tracking_sessions (user_id, start_time, is_active) VALUES ($1, NOW(), true) RETURNING id`,
      [user_id]
    );
    res.status(201).json({ sessionId: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: "Error starting session" });
  }
});

// Stop Session
router.post("/stop-session", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { sessionId } = req.body;
  try {
    await pool.query("UPDATE tracking_sessions SET is_active = false, end_time = NOW() WHERE id = $1", [sessionId]);
    res.json({ message: "Session stopped" });
  } catch (err) {
    res.status(500).json({ error: "Error stopping session" });
  }
});

// TRACKING LOGIC
router.post("/track", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const user_id = req.userId;
  const { sessionId, latitude, longitude, neighborhoods } = req.body;

  if (!sessionId || !latitude || !longitude) return res.status(400).json({ error: "Missing data" });

  try {
    // 1. Get last point to calc distance
    const lastLoc = await pool.query(
      `SELECT latitude, longitude FROM location_points WHERE session_id = $1 ORDER BY timestamp DESC LIMIT 1`,
      [sessionId]
    );

    let dist = 0;
    if (lastLoc.rows.length > 0) {
      dist = calculateDistance(lastLoc.rows[0].latitude, lastLoc.rows[0].longitude, latitude, longitude);
    }

    // 2. Save Point
    await pool.query(
      "INSERT INTO location_points (session_id, latitude, longitude, timestamp) VALUES ($1, $2, $3, NOW())",
      [sessionId, latitude, longitude]
    );

    const steps = calculateSteps(dist);
    // 3. Update Session Totals
    await pool.query(
      "UPDATE tracking_sessions SET total_distance = total_distance + $1, total_steps = total_steps + $2 WHERE id = $3",
      [dist, steps, sessionId]
    );

    // fetch updated session totals for achievement checks
    const sessionRow = await pool.query('SELECT total_steps FROM tracking_sessions WHERE id = $1', [sessionId]);
    const sessionTotalSteps = sessionRow.rows.length > 0 ? sessionRow.rows[0].total_steps : 0;

    // 4. CHECK NEIGHBORHOODS & CAPTURE LOGIC
    let neighborhoodId = null;
    let didCapture = false;

    if (neighborhoods && Array.isArray(neighborhoods)) {
      const point = { latitude, longitude };
      for (const n of neighborhoods) {
        if (isPointInPolygon(point, n.coordinates)) {
          neighborhoodId = n.id;
          
          // A. Record visit steps for this session
          const visitResult = await pool.query(
            `INSERT INTO neighborhood_visits (session_id, neighborhood_id, steps)
             VALUES ($1, $2, $3)
             ON CONFLICT (session_id, neighborhood_id) 
             DO UPDATE SET steps = neighborhood_visits.steps + $3
             RETURNING steps`,
            [sessionId, n.id, steps]
          );
          
          const currentSessionSteps = visitResult.rows[0].steps;

          // B. CHECK IF WE OVERTHROW THE KING
          // Check current owner and max steps
          const ownerCheck = await pool.query(
            "SELECT user_id, max_steps FROM neighborhood_ownership WHERE neighborhood_id = $1",
            [n.id]
          );

          let currentRecord = 0;
          let previousOwnerId: number | null = null;
          if (ownerCheck.rows.length > 0) {
            currentRecord = ownerCheck.rows[0].max_steps;
            previousOwnerId = ownerCheck.rows[0].user_id;
          }

          if (currentSessionSteps > currentRecord) {
            // NEW KING!
            await pool.query(
              `INSERT INTO neighborhood_ownership (neighborhood_id, user_id, max_steps, captured_at)
               VALUES ($1, $2, $3, NOW())
               ON CONFLICT (neighborhood_id) 
               DO UPDATE SET user_id = $2, max_steps = $3, captured_at = NOW()`,
              [n.id, user_id, currentSessionSteps]
            );

            // If there was a previous owner and it's not the same as the new owner, create a notification
            if (previousOwnerId && previousOwnerId !== user_id) {
              try {
                const actorRes = await pool.query(`SELECT name FROM users WHERE id = $1`, [user_id]);
                const actorName = actorRes.rows.length > 0 ? actorRes.rows[0].name : 'Someone';
                const message = `${actorName} captured your turf ${n.id} with ${currentSessionSteps} steps.`;
                await pool.query(
                  `INSERT INTO notifications (user_id, actor_id, neighborhood_id, message, is_read, created_at)
                   VALUES ($1, $2, $3, $4, false, NOW())`,
                  [previousOwnerId, user_id, n.id, message]
                );
              } catch (notifErr) {
                console.error('Failed to create notification:', notifErr);
              }
            }

            // Award capture-related achievements
            try {
              // first capture: check if user already has any user_achievements for code 'first_capture'
              const uaRes = await pool.query(
                `SELECT 1 FROM user_achievements ua JOIN achievements a ON ua.achievement_id = a.id WHERE ua.user_id = $1 AND a.code = 'first_capture' LIMIT 1`,
                [user_id]
              );
              if (uaRes.rows.length === 0) {
                await awardAchievement(user_id as number, 'first_capture', { neighborhood: n.id });
              }

              // big capture
              if (currentSessionSteps >= 5000) {
                await awardAchievement(user_id as number, 'capture_big', { neighborhood: n.id, steps: currentSessionSteps });
              }
            } catch (achErr) {
              console.error('Achievement award error:', achErr);
            }

            didCapture = true;
            console.log(`User ${user_id} captured ${n.id} with ${currentSessionSteps} steps!`);
          }
          break; // Only in one neighborhood at a time
        }
      }
    }

    // Check for session-level achievements (marathon)
    try {
      if (sessionTotalSteps >= 10000) {
        await awardAchievement(user_id as number, 'session_marathon', { sessionId, totalSteps: sessionTotalSteps });
      }
    } catch (err) {
      console.error('Session achievement check failed', err);
    }

    res.json({ 
      distance: dist, 
      steps: steps, 
      neighborhoodId, 
      captured: didCapture 
    });

  } catch (err: any) {
    console.error("Tracking Error:", err);
    res.status(500).json({ error: "Internal Error" });
  }
});

export default router;