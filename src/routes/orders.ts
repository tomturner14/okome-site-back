// src/routes/orders.ts
import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireUser } from "../middlewares/requireUser.js";
import { sendError } from "../lib/errors.js";

const router = Router();

// すべて認証必須
router.use(requireUser);

/**
 * GET /api/orders
 * ログインユーザーの注文一覧
 */
router.get("/", async (req, res) => {
  res.set("Cache-Control", "no-store");
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

    const data = rows.map((o) => ({
      id: o.id,
      total_price: o.total_price,
      status: String(o.status),
      fulfill_status: String(o.fulfill_status),
      ordered_at: o.ordered_at.toISOString(),
      items:
        o.items?.map((i) => ({
          title: i.title,
          quantity: i.quantity,
          price: i.price,
          image_url: i.image_url ?? "",
        })) ?? [],
    }));

    return res.json(data);
  } catch {
    return sendError(res, "DB_ERROR");
  }
});

/**
 * GET /api/orders/:id
 * ログインユーザー自身の単一注文詳細を返す
 */
router.get("/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");

  const userId = req.session.userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return sendError(res, "VALIDATION", "id が不正です");
  }

  try {
    const row = await prisma.order.findFirst({
      where: { id, user_id: userId },
      include: {
        items: {
          select: {
            title: true,
            quantity: true,
            price: true,
            image_url: true,
          },
        },
        address: {
          select: {
            id: true,
            recipient_name: true,
            postal_code: true,
            address_1: true,
            address_2: true,
            phone: true,
            created_at: true,
            updated_at: true,
          },
        },
      },
    });

    if (!row) {
      return sendError(res, "VALIDATION", "注文が見つかりません");
    }

    const data = {
      id: row.id,
      total_price: row.total_price,
      status: String(row.status),
      fulfill_status: String(row.fulfill_status),
      ordered_at: row.ordered_at.toISOString(),
      cancelled_at: row.cancelled_at ? row.cancelled_at.toISOString() : null,
      fulfilled_at: row.fulfilled_at ? row.fulfilled_at.toISOString() : null,
      items:
        row.items?.map((i) => ({
          title: i.title,
          quantity: i.quantity,
          price: i.price,
          image_url: i.image_url ?? "",
        })) ?? [],
      address: row.address
        ? {
          id: row.address.id,
          recipient_name: row.address.recipient_name,
          postal_code: row.address.postal_code,
          address_1: row.address.address_1,
          address_2: row.address.address_2 ?? "",
          phone: row.address.phone,
          created_at: row.address.created_at.toISOString(),
          updated_at: row.address.updated_at.toISOString(),
        }
        : null,
    };

    return res.json(data);
  } catch {
    return sendError(res, "DB_ERROR");
  }
});

export default router;
