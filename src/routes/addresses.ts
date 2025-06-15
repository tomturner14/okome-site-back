// src/routes/addresses.ts
import { Router } from "express";
import prisma from "../lib/prisma.js";
import { addressSchema } from "../validators/address.js";

// 仮の認証ミドルウェア（必要に応じて書き換え）
const requireUser = (req, res, next) => {
  // 本来は req.session.user.id などに切り替える
  req.user = { id: 1 }; // 仮ユーザーID
  next();
};

const router = Router();

router.use(requireUser);

// GET /api/addresses
router.get("/", async (req, res) => {
  try {
    const addresses = await prisma.userAddress.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: "desc" },
    });
    res.json(addresses);
  } catch (error) {
    console.error("GET /addresses error:", error);
    res.status(500).json({ error: "住所一覧の取得に失敗しました" });
  }
});

// POST /api/addresses
router.post("/", async (req, res) => {
  try {
    const parsed = addressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "バリデーションエラー", details: parsed.error.format() });
    }

    const address = await prisma.userAddress.create({
      data: {
        user_id: req.user.id,
        ...parsed.data,
      },
    });

    res.status(201).json(address);
  } catch (error) {
    console.error("POST /addresses error:", error);
    res.status(500).json({ error: "住所の登録に失敗しました" });
  }
});

export default router;
