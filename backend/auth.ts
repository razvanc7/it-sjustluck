import express, { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "./db";

const router = express.Router();
const JWT_SECRET = "secret_key";

const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

// Register
router.post("/register", async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "Toate câmpurile sunt obligatorii" });

  try {
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Email deja folosit" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userColor = getRandomColor(); 

    const result = await pool.query(
      "INSERT INTO users (name, email, password, color, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, name, email, color",
      [name, email, hashedPassword, userColor]
    );

    const newUser = result.rows[0];
    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      token,
      user: { 
        id: newUser.id, 
        name: newUser.name, 
        email: newUser.email,
        color: newUser.color 
      }
    });
  } catch (err: any) {
    console.error("Registration error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email și parola sunt obligatorii" });

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (result.rows.length === 0)
      return res.status(400).json({ error: "User inexistent" });

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword)
      return res.status(400).json({ error: "Parolă incorectă" });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      token,
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        color: user.color 
      }
    });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Eroare la server" });
  }
});

export default router;