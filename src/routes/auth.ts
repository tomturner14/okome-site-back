import { Router } from "express";
import prisma from "../lib/prisma.js";
import bcrypt from "bcryptjs";
import { sendError } from "../lib/sendError.js";

const router = Router();

// 会員登録
router.post("/register", async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password) {
    return sendError(res, 400, "VALIDATION_ERROR", "email と password は必須です");
  }
  if (String(password).length < 6) {
    return sendError(res, 400, "VALIDATION_ERROR", "password は 6 文字以上にしてください");
  }

  try {
    const normalized = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalized } });
    if (existing) {
      return sendError(res, 409, "ALREADY_EXISTS", "既に登録されています");
    }

    const hashed_password = await bcrypt.hash(String(password), 12);
    const user = await prisma.user.create({
      data: { email: normalized, name: name ?? "", hashed_password },
      select: { id: true, email: true, name: true },
    });

    (req.session as any).userId = user.id;
    return res.json({ ok: true, user });
  } catch (e) {
    return sendError(res, 500, "DB_ERROR", "サーバー内部でエラーが発生しました");
  }
});

// ログイン
router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return sendError(res, 400, "VALIDATION_ERROR", "email と password は必須です");
  }

  try {
    const normalized = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalized } });

    if (!user || !user.hashed_password) {
      return sendError(res, 401, "INVALID_CREDENTIALS", "メールまたはパスワードが違います");
    }

    const ok = await bcrypt.compare(String(password), user.hashed_password);
    if (!ok) {
      return sendError(res, 401, "INVALID_CREDENTIALS", "メールまたはパスワードが違います");
    }

    (req.session as any).userId = user.id;
    return res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    return sendError(res, 500, "DB_ERROR", "サーバー内部でエラーが発生しました");
  }
});

// ログアウト
router.post("/logout", (req, res) => {
  req.session = null as any;
  res.json({ ok: true });
});

export default router;
