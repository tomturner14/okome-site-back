// src/routes/orders.ts
import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireUser } from "../middlewares/requireUser.js";
import { sendError } from "../lib/errors.js";

const router = Router();

// 認証必須
router.use(requireUser);

/**
 * 現在ログイン中ユーザーの注文一覧
 * レスポンス形はフロントの OrdersResponseSchema に合わせる
 */
router.get("/", async (req, res) => {
  try {
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

    // zod 側に合わせて整形（Date → ISO 文字列）
    const data = rows.map((o) => ({
      id: o.id,
      total_price: o.total_price,
      status: o.status,
      fulfill_status: o.fulfill_status,
      ordered_at: o.ordered_at.toISOString(),
      items: o.items?.map((it) => ({
        title: it.title,
        quantity: it.quantity,
        price: it.price,
        image_url: it.image_url ?? "",
      })) ?? [],
    }));

    res.json(data);
  } catch (e) {
    return sendError(res, "DB_ERROR");
  }
});

export default router;
