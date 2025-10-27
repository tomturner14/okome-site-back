import { Router } from "express";
import prisma from "../lib/prisma.js";
import bcrypt from "bcryptjs";
import { sendError } from "../lib/errors.js";

const router = Router();

// 会員登録
router.post("/register", async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password) {
    return sendError(res, "VALIDATION", "email と password は必須です");
  }
  if (String(password).length < 6) {
    return sendError(res, "WEAK_PASSWORD");
  }

  try {
    const normalized = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalized } });
    if (existing) {
      return sendError(res, "EMAIL_ALREADY_REGISTERED");
    }

    const hashed_password = await bcrypt.hash(String(password), 12);
    const user = await prisma.user.create({
      data: { email: normalized, name: name ?? "", hashed_password },
      select: { id: true, email: true, name: true },
    });

    (req.session as any).userId = user.id;
    return res.json({ ok: true, user });
  } catch {
    return sendError(res, "DB_ERROR");
  }
});

// ログイン
router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return sendError(res, "VALIDATION", "email と password は必須です");
  }

  try {
    const normalized = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalized } });

    if (!user || !user.hashed_password) {
      return sendError(res, "INVALID_EMAIL_OR_PASSWORD");
    }

    const ok = await bcrypt.compare(String(password), user.hashed_password);
    if (!ok) {
      return sendError(res, "INVALID_EMAIL_OR_PASSWORD");
    }

    (req.session as any).userId = user.id;
    return res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch {
    return sendError(res, "DB_ERROR");
  }
});

// ログアウト
router.post("/logout", (req, res) => {
  req.session = null as any;
  res.json({ ok: true });
});

export default router;
