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

router.get("/", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const user_id = req.userId;

  try {
    const userResult = await pool.query(
      "SELECT id, name, email, created_at FROM users WHERE id = $1",
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const statsResult = await pool.query(
      `SELECT 
        COALESCE(SUM(total_distance), 0) as total_distance,
        COALESCE(SUM(total_steps), 0) as total_steps,
        COUNT(*) FILTER (WHERE is_active = false) as total_sessions,
        COUNT(*) FILTER (WHERE is_active = true) as active_sessions
       FROM tracking_sessions 
       WHERE user_id = $1`,
      [user_id]
    );

    const neighborhoodsResult = await pool.query(
      `SELECT COUNT(DISTINCT neighborhood_id) as unique_neighborhoods
       FROM neighborhood_visits nv
       JOIN tracking_sessions ts ON ts.id = nv.session_id
       WHERE ts.user_id = $1`,
      [user_id]
    );

    const avgDistanceResult = await pool.query(
      `SELECT AVG(total_distance) as avg_distance
       FROM tracking_sessions
       WHERE user_id = $1 AND is_active = false AND total_distance > 0`,
      [user_id]
    );

    const user = userResult.rows[0];
    const stats = statsResult.rows[0];
    const neighborhoods = neighborhoodsResult.rows[0];
    const avgDistance = avgDistanceResult.rows[0];

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.created_at,
      statistics: {
        total_distance: parseFloat(stats.total_distance) || 0,
        total_steps: parseInt(stats.total_steps) || 0,
        total_sessions: parseInt(stats.total_sessions) || 0,
        active_sessions: parseInt(stats.active_sessions) || 0,
        unique_neighborhoods: parseInt(neighborhoods.unique_neighborhoods) || 0,
        avg_distance_per_session: parseFloat(avgDistance.avg_distance) || 0
      }
    });
  } catch (err: any) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ error: "Server error fetching profile." });
  }
});

router.get("/:userId", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const target_user_id = parseInt(req.params.userId);

  if (!target_user_id) {
    return res.status(400).json({ error: "Invalid user ID." });
  }

  try {
    const userResult = await pool.query(
      "SELECT id, name, created_at FROM users WHERE id = $1",
      [target_user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const statsResult = await pool.query(
      `SELECT 
        COALESCE(SUM(total_distance), 0) as total_distance,
        COALESCE(SUM(total_steps), 0) as total_steps,
        COUNT(*) FILTER (WHERE is_active = false) as total_sessions
       FROM tracking_sessions 
       WHERE user_id = $1`,
      [target_user_id]
    );

    const neighborhoodsResult = await pool.query(
      `SELECT COUNT(DISTINCT neighborhood_id) as unique_neighborhoods
       FROM neighborhood_visits nv
       JOIN tracking_sessions ts ON ts.id = nv.session_id
       WHERE ts.user_id = $1`,
      [target_user_id]
    );

    const user = userResult.rows[0];
    const stats = statsResult.rows[0];
    const neighborhoods = neighborhoodsResult.rows[0];

    res.json({
      id: user.id,
      name: user.name,
      created_at: user.created_at,
      statistics: {
        total_distance: parseFloat(stats.total_distance) || 0,
        total_steps: parseInt(stats.total_steps) || 0,
        total_sessions: parseInt(stats.total_sessions) || 0,
        unique_neighborhoods: parseInt(neighborhoods.unique_neighborhoods) || 0
      }
    });
  } catch (err: any) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ error: "Server error fetching profile." });
  }
});

router.get("/leaderboard/distance", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const leaderboard = await pool.query(
      `SELECT 
        u.id,
        u.name,
        COALESCE(SUM(ts.total_distance), 0) as total_distance,
        COALESCE(SUM(ts.total_steps), 0) as total_steps,
        COUNT(DISTINCT nv.neighborhood_id) as unique_neighborhoods
       FROM users u
       LEFT JOIN tracking_sessions ts ON ts.user_id = u.id AND ts.is_active = false
       LEFT JOIN neighborhood_visits nv ON nv.session_id = ts.id
       GROUP BY u.id, u.name
       ORDER BY total_distance DESC
       LIMIT 50`,
      []
    );

    res.json(leaderboard.rows.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      name: row.name,
      total_distance: parseFloat(row.total_distance) || 0,
      total_steps: parseInt(row.total_steps) || 0,
      unique_neighborhoods: parseInt(row.unique_neighborhoods) || 0
    })));
  } catch (err: any) {
    console.error("Leaderboard fetch error:", err);
    res.status(500).json({ error: "Server error fetching leaderboard." });
  }
});

export default router;