import { Router } from "express";
import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";

const router = Router();

// POST api/users/register - 新規ユーザー登録
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "すべての項目を入力してください" });
  }

  // 既存ユーザーの確認
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(400).json({ error: "このメールアドレスは既に使われています" });
  }

  const hashed = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      email,
      hashed_password: hashed,
    },
  });

  return res.status(200).json({ message: "ユーザー登録が完了しました" });
});

export default router;