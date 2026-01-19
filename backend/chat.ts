import express, { Request, Response } from "express";
import pool from "./db";
import { authenticateToken } from "./location"; // We will export this next

const router = express.Router();

// Get messages for a specific neighborhood
router.get("/:neighborhoodId", authenticateToken, async (req: any, res: Response) => {
  try {
    const { neighborhoodId } = req.params;
    // UPDATED QUERY: Select u.color
    const result = await pool.query(
      `SELECT cm.id, cm.message, cm.created_at, u.name as user_name, u.color as user_color, cm.user_id 
       FROM chat_messages cm 
       JOIN users u ON cm.user_id = u.id 
       WHERE cm.neighborhood_id = $1 
       ORDER BY cm.created_at ASC 
       LIMIT 50`,
      [neighborhoodId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Post a new message
router.post("/:neighborhoodId", authenticateToken, async (req: any, res: Response) => {
  try {
    const { neighborhoodId } = req.params;
    const { message } = req.body;
    const userId = req.userId;

    if (!message) return res.status(400).json({ error: "Message empty" });

    // Save to DB
    const result = await pool.query(
      `INSERT INTO chat_messages (neighborhood_id, user_id, message) 
       VALUES ($1, $2, $3) RETURNING id, created_at`,
      [neighborhoodId, userId, message]
    );

    // Get sender name AND color for response
    const userRes = await pool.query("SELECT name, color FROM users WHERE id = $1", [userId]);
    const userData = userRes.rows[0];

    const newMessage = {
      id: result.rows[0].id,
      neighborhood_id: neighborhoodId,
      user_id: userId,
      user_name: userData.name,
      user_color: userData.color, // Return color immediately
      message: message,
      created_at: result.rows[0].created_at
    };
    
    res.json(newMessage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;