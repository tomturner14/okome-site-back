import express from "express";
import { auth } from "../lib/auth";
import prisma from "../lib/prisma";

const router = express.Router();

// ログイン処理
router.post("/login", async (req, res) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const session = await auth.createSession(user.id);
  auth.setSessionCookie(res, session);

  res.json({ message: "Logged in" });
});

// ログアウト処理
router.post("/logout", async (req, res) => {
  const session = await auth.getSession(req);
  if (session) {
    await auth.invalidateSession(session.id);
    auth.clearSessionCookie(res);
  }
  res.json({ message: "Logged out" });
});

// ログイン中のユーザー情報取得
router.get("/me", async (req, res) => {
  const session = await auth.getSession(req);
  if (!session) return res.status(401).json({ error: "Not authenticated" });

  const user = await prisma.user.findUnique({
    where: { id: session.user_id },
    select: { id: true, name: true, email: true }
  });

  res.json(user);
});

export default router;