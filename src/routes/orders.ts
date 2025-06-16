import { Router } from "express";
import prisma from "../lib/prisma.js";
import { orderSchema } from "../validators/order.js";
import { requireUser } from "../middlewares/requireUser.js";

const router = Router();

router.use(requireUser);

router.post("/", async (req, res) => {
  const userId = req.session.userId!;
  const parsed = orderSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "バリデーション失敗", details: parsed.error.format() });
  }

  const { address_id, total_price, shopify_order_id, ordered_at, items } = parsed.data;

  const order = await prisma.order.create({
    data: {
      user_id: userId,
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
    include: { items: true },
  });

  res.status(201).json({ success: true, order });
});

export default router;
