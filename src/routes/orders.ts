import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireUser } from "../middlewares/requireUser.js";
import { sendError } from "../lib/errors.js";

const router = Router();

// すべてのルートでログイン必須
router.use(requireUser);

// 注文一覧（既存があれば近い形でOK）
router.get("/", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.session.userId as number;

  const rows = await prisma.order.findMany({
    where: { user_id: userId },
    orderBy: { ordered_at: "desc" },
    select: {
      id: true,
      total_price: true,
      status: true,
      fulfill_status: true,
      ordered_at: true,
    },
  });

  return res.json(rows);
});

// 注文詳細（今回の主役）
router.get("/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.session.userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return sendError(res, "VALIDATION", "不正なIDです");
  }

  try {
    const order = await prisma.order.findFirst({
      where: { id, user_id: userId },
      select: {
        id: true,
        total_price: true,
        status: true,
        fulfill_status: true,
        ordered_at: true,
        items: {
          select: {
            title: true,
            quantity: true,
            price: true,
            image_url: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!order) return sendError(res, "VALIDATION", "対象の注文が見つかりません");

    return res.json(order);
  } catch {
    return sendError(res, "DB_ERROR");
  }
});

export default router;
