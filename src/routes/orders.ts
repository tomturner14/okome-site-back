// src/routes/orders.ts
import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireUser } from "../middlewares/requireUser.js";
import { sendError } from "../lib/errors.js";

const router = Router();

// すべて要ログイン
router.use(requireUser);

/**
 * GET /api/orders
 * ログインユーザーの注文一覧を返す
 * 返却形はフロントの OrderSchema / OrdersResponseSchema と揃える
 */
router.get("/", async (req, res) => {
  res.set("Cache-Control", "no-store");

  const userId = req.session.userId;
  if (typeof userId !== "number") {
    return sendError(res, "UNAUTHORIZED"); // 401
  }

  try {
    const rows = await prisma.order.findMany({
      where: { user_id: userId },
      orderBy: { ordered_at: "desc" },
      include: {
        items: {
          select: {
            title: true,
            quantity: true,
            price: true,
            image_url: true,
          },
        },
      },
    });

    const data = rows.map((o) => ({
      id: o.id,
      total_price: o.total_price,
      status: String(o.status),
      fulfill_status: String(o.fulfill_status),
      ordered_at: o.ordered_at.toISOString(),
      items: (o.items ?? []).map((i) => ({
        title: i.title,
        quantity: i.quantity,
        price: i.price,
        image_url: i.image_url ?? "",
      })),
    }));

    return res.json(data);
  } catch {
    return sendError(res, "DB_ERROR");
  }
});

export default router;
