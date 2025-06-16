import { Router } from "express";
import prisma from "../lib/prisma.js";
import { addressSchema } from "../validators/address.js";
import { requireUser } from "../middlewares/requireUser.js";

const router = Router();

router.use(requireUser); // 認証が必要

// GET /api/addresses
router.get("/", async (req, res) => {
  const addresses = await prisma.userAddress.findMany({
    where: { user_id: req.user.id },
    orderBy: { created_at: "desc" },
  });
  res.json(addresses);
});

// POST /api/addresses
router.post("/", async (req, res) => {
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
});

export default router;
