import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import pool from "./db";

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

    const ownershipResult = await pool.query(
      `SELECT COUNT(*) as owned_count
       FROM neighborhood_ownership
       WHERE user_id = $1`,
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
    const avgDistance = avgDistanceResult.rows[0];
    const owned = ownershipResult.rows[0];

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
        unique_neighborhoods: parseInt(owned.owned_count) || 0,
        avg_distance_per_session: parseFloat(avgDistance.avg_distance) || 0
      }
    });
  } catch (err: any) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ error: "Server error fetching profile." });
  }
});

export default router;