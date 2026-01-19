import express, { Request, Response } from "express";
import pool from "./db";

const router = express.Router();

// Get leaderboard (occupied turfs)
router.get("/", async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        no.neighborhood_id, 
        u.name as owner_name, 
        no.max_steps, 
        no.captured_at
      FROM neighborhood_ownership no
      JOIN users u ON no.user_id = u.id
      ORDER BY no.max_steps DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;