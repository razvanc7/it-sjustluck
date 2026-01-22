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

// Update Profile Route
router.put("/", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId;
  const { name, email, color } = req.body;

  try {
    // Only update fields that are provided
    if (name) {
       // Check availability
       const exist = await pool.query('SELECT id FROM users WHERE name = $1 AND id != $2', [name, userId]);
       if (exist.rows.length > 0) return res.status(400).json({ error: 'Username already taken.' });
    }
    
    // Dynamic query construction
    let query = "UPDATE users SET ";
    const values = [];
    let idx = 1;

    if (name) {
      query += `name = $${idx++}, `;
      values.push(name);
    }
    if (email) {
      query += `email = $${idx++}, `;
      values.push(email);
    }
    if (color) {
      query += `color = $${idx++}, `;
      values.push(color);
    }
    
    // Remove trailing comma and space
    if (values.length === 0) return res.status(400).json({ error: "No fields to update." });
    query = query.slice(0, -2);
    
    query += ` WHERE id = $${idx}`;
    values.push(userId);

    await pool.query(query, values);

    // Return updated user info
    const updatedUser = await pool.query('SELECT name, email, color FROM users WHERE id = $1', [userId]);
    res.json({ message: "Profile updated successfully.", user: updatedUser.rows[0] });

  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Server error updating profile." });
  }
});

export default router;