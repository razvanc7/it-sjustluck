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

    // CREATE NOTIFICATION FOR FRIEND REQUEST
    try {
      const senderRes = await pool.query("SELECT name FROM users WHERE id = $1", [sender_id]);
      const senderName = senderRes.rows.length > 0 ? senderRes.rows[0].name : 'Someone';
      const message = `${senderName} sent you a friend request.`;
      
      await pool.query(
        `INSERT INTO notifications (user_id, actor_id, neighborhood_id, message, is_read, created_at)
         VALUES ($1, $2, $3, $4, false, NOW())`,
        [receiver_id, sender_id, null, message]
      );
    } catch (notifErr) {
      console.error('Failed to create friend request notification:', notifErr);
      // Don't fail the request if notification fails
    }

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

// Get friend details (profile + stats + owned neighborhoods)
router.get('/:id/details', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const requester = req.userId;
    const friendId = parseInt(req.params.id);

    if (!requester || !friendId) return res.status(400).json({ error: 'Invalid ids.' });

    try {
        // Verify friendship exists and is accepted
        const rel = await pool.query(
            `SELECT 1 FROM friends WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)) AND status = 'accepted' LIMIT 1`,
            [requester, friendId]
        );

        if (rel.rows.length === 0) return res.status(403).json({ error: 'You are not friends with this user.' });

        // Fetch basic profile
        const userResult = await pool.query("SELECT id, name, email, created_at, color FROM users WHERE id = $1", [friendId]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
        const user = userResult.rows[0];

        // Stats (reuse profile logic)
        const statsResult = await pool.query(
            `SELECT 
                COALESCE(SUM(total_distance), 0) as total_distance,
                COALESCE(SUM(total_steps), 0) as total_steps,
                COUNT(*) FILTER (WHERE is_active = false) as total_sessions,
                COUNT(*) FILTER (WHERE is_active = true) as active_sessions
             FROM tracking_sessions 
             WHERE user_id = $1`,
            [friendId]
        );

        const ownershipResult = await pool.query(
            `SELECT neighborhood_id, max_steps, captured_at FROM neighborhood_ownership WHERE user_id = $1`,
            [friendId]
        );

        const avgDistanceResult = await pool.query(
            `SELECT AVG(total_distance) as avg_distance
             FROM tracking_sessions
             WHERE user_id = $1 AND is_active = false AND total_distance > 0`,
            [friendId]
        );

        const stats = statsResult.rows[0];
        const avgDistance = avgDistanceResult.rows[0];

            res.json({
                id: user.id,
                name: user.name,
                email: user.email,
                created_at: user.created_at,
                color: user.color,
            statistics: {
                total_distance: parseFloat(stats.total_distance) || 0,
                total_steps: parseInt(stats.total_steps) || 0,
                total_sessions: parseInt(stats.total_sessions) || 0,
                active_sessions: parseInt(stats.active_sessions) || 0,
                unique_neighborhoods: ownershipResult.rowCount || 0,
                avg_distance_per_session: parseFloat(avgDistance.avg_distance) || 0
            },
            owned_neighborhoods: ownershipResult.rows
        });
    } catch (err: any) {
        console.error('Error fetching friend details:', err);
        res.status(500).json({ error: 'Server error fetching friend details.' });
    }
});
export default router;