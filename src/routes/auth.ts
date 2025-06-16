import { Router } from "express";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";

const router = Router();

// サインアップ
router.post("/signup", async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "名前、メール、パスワードは必須です" });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(400).json({ error: "このメールアドレスは既に登録されています" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      hashed_password: hashedPassword,
    },
  });

  req.session.userId = newUser.id;
  res.status(201).json({ message: "登録成功", user: { id: newUser.id, name: newUser.name } });
});

// ログイン
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) {
    return res.status(401).json({ error: "認証に失敗しました" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: "認証に失敗しました" });
  }

  req.session.userId = user.id;
  res.json({ message: "ログイン成功", user: { id: user.id, name: user.name } });
});

// ログアウト
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "ログアウトに失敗しました" });
    res.clearCookie("connect.sid");
    res.json({ message: "ログアウトしました" });
  });
});

export default router;
