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
    const result = await pool.query(
      `SELECT
          u.id, u.name, u.email
       FROM friends f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1 AND f.status = 'accepted'`,
      [user_id]
    );

    res.json(result.rows);
  } catch (err: any) {
    console.error("Friends fetch error:", err);
    res.status(500).json({ error: "Server error fetching friends." });
  }
});

router.post("/", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const sender_id = req.userId;

  const { friend_name } = req.body; 

  if (!sender_id || !friend_name) return res.status(400).json({ error: "Numele prietenului este necesar." });

  try {
    const receiverResult = await pool.query(
      "SELECT id FROM users WHERE LOWER(name) = LOWER($1)",
      [friend_name]
    );
    
    if (receiverResult.rows.length === 0) {
      return res.status(404).json({ error: "Utilizatorul cu acest nume nu a fost găsit." });
    }
    
    const receiver_id = receiverResult.rows[0].id;
    
    if (sender_id === receiver_id) {
        return res.status(400).json({ error: "Nu îți poți trimite cerere ție însuți." });
    }

    const existingFriendship = await pool.query(
      `SELECT status FROM friends 
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [sender_id, receiver_id]
    );

    if (existingFriendship.rows.length > 0) {
        const status = existingFriendship.rows[0].status;
        if (status === 'accepted') {
            return res.status(400).json({ error: "Sunteți deja prieteni." });
        }
        if (status === 'pending') {
            const isSentByMe = existingFriendship.rows[0].user_id === sender_id;
            return res.status(400).json({ 
                error: isSentByMe ? "Cererea de prietenie a fost deja trimisă." : "Ai deja o cerere de la acest utilizator."
            });
        }
    }
    
    await pool.query(
      "INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'pending')",
      [sender_id, receiver_id]
    );

    res.status(201).json({ message: `Cerere de prietenie trimisă către ${friend_name}.` });
  } catch (err: any) {
    console.error("Error sending friend request:", err);
    res.status(500).json({ error: "Server error sending friend request." });
  }
});

router.get("/requests", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const receiver_id = req.userId;

    try {
        const result = await pool.query(
            `SELECT
                f.id as request_id, 
                u.id as sender_id, 
                u.name as sender_name, 
                u.email as sender_email
             FROM friends f
             JOIN users u ON u.id = f.user_id
             WHERE f.friend_id = $1 AND f.status = 'pending'`,
            [receiver_id]
        );

        res.json(result.rows);
    } catch (err: any) {
        console.error("Error fetching requests:", err);
        res.status(500).json({ error: "Server error fetching requests." });
    }
});

router.post("/accept", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const receiver_id = req.userId;
    const { sender_id } = req.body;

    if (!receiver_id || !sender_id) return res.status(400).json({ error: "ID-ul expeditorului este necesar." });

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); 

        const updateRequest = await client.query(
            `UPDATE friends SET status = 'accepted' 
             WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`,
            [sender_id, receiver_id]
        );

        if (updateRequest.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Cerere de prietenie invalidă sau deja procesată." });
        }

        await client.query(
            "INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'accepted')",
            [receiver_id, sender_id]
        );

        await client.query('COMMIT'); 
        res.json({ message: "Cerere de prietenie acceptată cu succes." });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("Error accepting request:", err);
        res.status(500).json({ error: "Server error accepting request." });
    } finally {
        client.release();
    }
});

router.post("/reject", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const user_id = req.userId;
    const { target_id } = req.body; 

    if (!user_id || !target_id) return res.status(400).json({ error: "ID-ul țintă este necesar." });

    try {
        const result = await pool.query(
            `DELETE FROM friends 
             WHERE (user_id = $2 AND friend_id = $1 AND status = 'pending')
                OR (user_id = $1 AND friend_id = $2 AND status = 'pending')`,
            [user_id, target_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Cerere pending nu a fost găsită." });
        }

        res.json({ message: "Cererea a fost refuzată/anulată cu succes." });
    } catch (err: any) {
        console.error("Error rejecting/cancelling request:", err);
        res.status(500).json({ error: "Server error rejecting request." });
    }
});

router.delete("/:friendId", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const user_id = req.userId;
    const friend_id = parseInt(req.params.friendId);

    if (!user_id || !friend_id) return res.status(400).json({ error: "ID-ul prietenului este necesar." });

    if (user_id === friend_id) {
        return res.status(400).json({ error: "Invalid operation." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `DELETE FROM friends 
             WHERE (user_id = $1 AND friend_id = $2 AND status = 'accepted')
                OR (user_id = $2 AND friend_id = $1 AND status = 'accepted')`,
            [user_id, friend_id]
        );

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Prietenie nu a fost găsită." });
        }

        await client.query('COMMIT');
        res.json({ message: "Prietenia a fost ștearsă cu succes." });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error("Error deleting friend:", err);
        res.status(500).json({ error: "Server error deleting friend." });
    } finally {
        client.release();
    }
});

export default router;