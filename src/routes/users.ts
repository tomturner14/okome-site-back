import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

// POST /users - 新規ユーザー登録
router.post("/", async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "name と email は必須です" });
  }

  try {
    const user = await prisma.user.create({
      data: { name, email }
    });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: "ユーザー作成に失敗しました", details: err });
  }
});

// GET /users - 全ユーザー取得
router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

export default router;