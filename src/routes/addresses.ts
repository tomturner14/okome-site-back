import { Router } from "express";
import prisma from "../lib/prisma.js";
import { addressSchema } from "../validators/address.js";
import { requireUser } from "../middlewares/requireUser.js";

const router = Router();

router.use(requireUser); // 全ルートに認証を適用

router.get("/", async (req, res) => {
  const userId = req.session.userId!;
  const addresses = await prisma.userAddress.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
  });
  res.json(addresses);
});

router.post("/", async (req, res) => {
  const userId = req.session.userId!;
  const parsed = addressSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "バリデーション失敗", details: parsed.error.format() });
  }

  const address = await prisma.userAddress.create({
    data: {
      user_id: userId,
      ...parsed.data,
    },
  });

  res.status(201).json(address);
});

export default router;
