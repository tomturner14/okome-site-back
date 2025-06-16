import express from "express";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";

const router = express.Router();

// サインアップ
router.post("/signup", async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "必須項目が不足しています" });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(400).json({ error: "すでに登録されています" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      password: hashedPassword,
    },
  });

  // セッションにuser_id保存
  req.session.userId = newUser.id;

  res.json({ message: "サインアップ成功", user: newUser });
});

// ログイン
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(400).json({ error: "ユーザーが見つかりません" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(400).json({ error: "パスワードが一致しません" });
  }

  req.session.userId = user.id;

  res.json({ message: "ログイン成功", user });
});

// ログアウト
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ message: "ログアウトしました" });
  });
});

export default router;
