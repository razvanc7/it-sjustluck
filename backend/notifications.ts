import express, { Request, Response, NextFunction } from "express";
import pool from "./db";
import jwt from "jsonwebtoken";

const router = express.Router();
const JWT_SECRET = "secret_key";

interface AuthenticatedRequest extends Request {
  userId?: number;
}

const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ error: "No token." });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token." });
    req.userId = (user as { id: number }).id;
    next();
  });
};

// Get notifications (unread first)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const result = await pool.query(
      `SELECT id, actor_id, neighborhood_id, message, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY is_read ASC, created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching notifications', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Mark a notification as read
router.post('/mark-read', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking notification read', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
