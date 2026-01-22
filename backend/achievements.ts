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

// HELPER: Initialize Achievements Tables if they are missing
const initAchievementsTables = async () => {
    console.log("Initializing/Updating achievements...");
    await pool.query(`
        CREATE TABLE IF NOT EXISTS achievements (
            id SERIAL PRIMARY KEY,
            code VARCHAR(100) UNIQUE NOT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            icon VARCHAR(200),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_achievements (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            achievement_id INTEGER REFERENCES achievements(id),
            awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            meta JSONB,
            UNIQUE(user_id, achievement_id)
        );
    `);
    
    // Seed Data (Added 2 new ones)
    const insertQuery = `
        INSERT INTO achievements (code, title, description, icon) VALUES
        ($1, $2, $3, $4),
        ($5, $6, $7, $8),
        ($9, $10, $11, $12),
        ($13, $14, $15, $16),
        ($17, $18, $19, $20)
        ON CONFLICT (code) DO NOTHING
    `;
    const values = [
        'first_capture', 'First Capture', 'Capture your first turf.', '🏆',
        'capture_big', 'Big Capture', 'Capture a turf with over 5,000 steps.', '💪',
        'session_marathon', 'Marathon Session', 'Accumulate 10,000 steps in a single session.', '🏃‍♂️',
        'distance_marathon', 'Marathon Runner', 'Accumulate 42km in total distance.', '👟',
        'turf_collector_5', 'Turf Tycoon', 'Capture 5 unique neighborhoods.', '🏰'
    ];
    await pool.query(insertQuery, values);
    console.log("Achievements initialized.");
};

// List all achievements (public)
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT id, code, title, description, icon, created_at FROM achievements ORDER BY id');
    
    // If we have fewer than 5, we likely need to seed the new ones
    if (result.rows.length < 5) {
        await initAchievementsTables();
        const result2 = await pool.query('SELECT id, code, title, description, icon, created_at FROM achievements ORDER BY id');
        return res.json(result2.rows);
    }
    res.json(result.rows);

  } catch (err: any) {
    if (err.code === '42P01' || (err.message && err.message.includes('does not exist'))) {
        try {
            await initAchievementsTables();
            const resultRetry = await pool.query('SELECT id, code, title, description, icon, created_at FROM achievements ORDER BY id');
            return res.json(resultRetry.rows);
        } catch (initErr: any) {
            console.error('Failed to auto-init tables:', initErr);
            return res.status(500).json({ error: 'Database init failed: ' + initErr.message });
        }
    }
    
    console.error('Error fetching achievements:', err);
    res.status(500).json({ error: err.message || 'Internal DB Error' });
  }
});

// Get user's achievements
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    try {
        await pool.query('SELECT 1 FROM user_achievements LIMIT 1');
    } catch (e: any) {
        if (e.code === '42P01') return res.json([]);
    }

    const result = await pool.query(
      `SELECT ua.id as user_achievement_id, a.code, a.title, a.description, a.icon, ua.awarded_at, ua.meta
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_id = a.id
       WHERE ua.user_id = $1
       ORDER BY ua.awarded_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err: any) {
    if (err.code === '42P01') return res.json([]);
    console.error('Error fetching user achievements:', err);
    res.status(500).json({ error: err.message || 'Internal User Achievement Error' });
  }
});

export default router;
