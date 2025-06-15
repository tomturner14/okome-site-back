// src/routes/orders.ts
import { Router } from "express";
import prisma from "../lib/prisma.js";
import { orderSchema } from "../validators/order.js";

// 仮の認証ミドルウェア（本番ではセッション認証と差し替え）
const requireUser = (req, res, next) => {
  req.user = { id: 1 }; // 仮のuser_id（後でセッションと接続）
  next();
};

const router = Router();
router.use(requireUser);

// POST /api/orders
router.post("/", async (req, res) => {
  try {
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "バリデーションエラー", details: parsed.error.format() });
    }

    const {
      address_id,
      total_price,
      shopify_order_id,
      ordered_at,
      items,
    } = parsed.data;

    const order = await prisma.order.create({
      data: {
        user_id: req.user.id,
        address_id,
        total_price,
        shopify_order_id,
        ordered_at: new Date(ordered_at),
        items: {
          create: items.map((item) => ({
            product_id: item.product_id,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
            image_url: item.image_url,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    res.status(201).json({ success: true, order });
  } catch (error) {
    console.error("POST /orders error:", error);
    res.status(500).json({ error: "注文登録に失敗しました" });
  }
});

export default router;
