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

// GET /users/:id/orders - ユーザーの注文履歴取得
router.get("/:id/orders", async (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    const orders = await prisma.order.findMany({
      where: { user_id: userId },
      include: { items: true },
      orderBy: { ordered_at: "desc" },
    });
    return res.json(orders);
  } catch (err) {
    console.error("Error fetching orders:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;