import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "../db.js";
import { signToken } from "../middleware/auth.js";

const router = Router();

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional().default(""),
  role: z.enum(["customer", "staff", "admin"]).optional().default("customer"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await query("SELECT id FROM users WHERE email = :email", {
      email: data.email,
    });

    if (existing.length) {
      return res.status(409).json({ message: "Email đã được sử dụng." });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const result = await query(
      `INSERT INTO users (full_name, email, password_hash, phone, role)
       VALUES (:fullName, :email, :passwordHash, :phone, :role)`,
      { ...data, passwordHash },
    );

    const user = {
      id: result.insertId,
      full_name: data.fullName,
      email: data.email,
      role: data.role,
    };

    return res.status(201).json({ user, token: signToken(user) });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const users = await query("SELECT * FROM users WHERE email = :email", data);
    const user = users[0];

    if (!user || !(await bcrypt.compare(data.password, user.password_hash))) {
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng." });
    }

    const sessionUser = {
      id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    };

    return res.json({
      user: sessionUser,
      token: signToken(sessionUser),
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
