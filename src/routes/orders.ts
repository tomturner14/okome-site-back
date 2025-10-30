// src/routes/orders.ts
import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireUser } from "../middlewares/requireUser.js";
import { sendError } from "../lib/errors.js";

const router = Router();

// すべて認証必須
router.use(requireUser);

/** 現在ログイン中の userId と email を取得（session.email が無ければDBから引く） */
async function getCurrentUser(req: any) {
  const userId = req.session?.userId as number | undefined;
  if (!userId) return { userId: undefined, email: undefined };
  const sessionEmail = req.session?.email as string | undefined;
  if (sessionEmail) return { userId, email: sessionEmail };
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return { userId, email: u?.email };
}

/** 内部: address_id を解決（指定が不正/未指定なら 既定→最古→null） */
async function resolveAddressId(userId: number, requested?: unknown): Promise<number | null> {
  const reqId = Number(requested);
  if (Number.isFinite(reqId)) {
    const owned = await prisma.userAddress.findFirst({
      where: { id: reqId, user_id: userId },
      select: { id: true },
    });
    if (owned) return owned.id;
  }
  const def = await prisma.userAddress.findFirst({
    where: { user_id: userId, is_default: true },
    select: { id: true },
  });
  if (def) return def.id;

  const first = await prisma.userAddress.findFirst({
    where: { user_id: userId },
    orderBy: { created_at: "asc" },
    select: { id: true },
  });
  return first ? first.id : null;
}

/**
 * GET /api/orders
 * ログインユーザーの注文一覧 + 「メール一致の未ひも付け」も表示
 */
router.get("/", async (req: any, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { userId, email } = await getCurrentUser(req);
    if (!userId && !email) return sendError(res, "UNAUTHORIZED");

    const where: any = {
      OR: [
        userId ? { user_id: userId } : undefined,
        email ? { user_id: null, email } : undefined,
      ].filter(Boolean),
    };

    const rows = await prisma.order.findMany({
      where,
      orderBy: { ordered_at: "desc" },
      select: {
        id: true,
        total_price: true,
        status: true,
        fulfill_status: true,
        ordered_at: true,
        items: {
          select: { title: true, quantity: true, price: true, image_url: true },
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
 * 許可条件: (order.user_id === me) OR (order.user_id is null AND order.email === me.email)
 * 住所は address 関連が無ければ shipping_* スナップショットを address 形で返す
 */
router.get("/:id", async (req: any, res) => {
  res.set("Cache-Control", "no-store");

  const { userId, email } = await getCurrentUser(req);
  if (!userId && !email) return sendError(res, "UNAUTHORIZED");

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, "VALIDATION", "id が不正です");

  try {
    const row = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { select: { title: true, quantity: true, price: true, image_url: true } },
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

    if (!row) return sendError(res, "VALIDATION", "注文が見つかりません");

    const canView =
      (userId && row.user_id === userId) ||
      (!row.user_id && email && row.email === email);
    if (!canView) return sendError(res, "FORBIDDEN", "権限がありません");

    // address が無ければ shipping_* スナップショットで代用（フロント互換shape）
    const address =
      row.address
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
        : (row.shipping_name ||
          row.shipping_postal_code ||
          row.shipping_address_1 ||
          row.shipping_address_2 ||
          row.shipping_phone)
          ? {
            id: null as any, // 紐付け無しのため
            recipient_name: row.shipping_name ?? "",
            postal_code: row.shipping_postal_code ?? "",
            address_1: row.shipping_address_1 ?? "",
            address_2: row.shipping_address_2 ?? "",
            phone: row.shipping_phone ?? "",
            created_at: row.ordered_at.toISOString(),
            updated_at: row.updated_at.toISOString(),
          }
          : null;

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
      address,
    };

    return res.json(data);
  } catch {
    return sendError(res, "DB_ERROR");
  }
});

/**
 * POST /api/orders
 * （既存のまま）注文作成
 */
router.post("/", async (req: any, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.session.userId as number;

  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const resolvedAddressId = await resolveAddressId(userId, req.body?.address_id);

    // 合計金額（明示指定がなければ items から算出）
    const bodyTotal = Number(req.body?.total_price);
    const itemsSum = items.reduce((acc: number, i: any) => {
      const q = Number(i?.quantity) || 1;
      const p = Number(i?.price) || 0;
      return acc + q * p;
    }, 0);
    const totalPrice = Number.isFinite(bodyTotal) ? bodyTotal : itemsSum;

    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          user_id: userId,
          address_id: resolvedAddressId,
          total_price: totalPrice,
        },
        select: { id: true },
      });

      if (items.length > 0) {
        await tx.orderItem.createMany({
          data: items.map((i: any) => ({
            order_id: order.id,
            title: String(i?.title ?? ""),
            quantity: Number(i?.quantity) || 1,
            price: Number(i?.price) || 0,
            image_url: typeof i?.image_url === "string" && i.image_url.length > 0 ? i.image_url : null,
          })),
        });
      }

      const row = await tx.order.findUnique({
        where: { id: order.id },
        include: {
          items: { select: { title: true, quantity: true, price: true, image_url: true } },
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

      return row!;
    });

    const data = {
      id: created.id,
      total_price: created.total_price,
      status: String(created.status),
      fulfill_status: String(created.fulfill_status),
      ordered_at: created.ordered_at.toISOString(),
      cancelled_at: created.cancelled_at ? created.cancelled_at.toISOString() : null,
      fulfilled_at: created.fulfilled_at ? created.fulfilled_at.toISOString() : null,
      items:
        created.items?.map((i) => ({
          title: i.title,
          quantity: i.quantity,
          price: i.price,
          image_url: i.image_url ?? "",
        })) ?? [],
      address: created.address
        ? {
          id: created.address.id,
          recipient_name: created.address.recipient_name,
          postal_code: created.address.postal_code,
          address_1: created.address.address_1,
          address_2: created.address.address_2 ?? "",
          phone: created.address.phone,
          created_at: created.address.created_at.toISOString(),
          updated_at: created.address.updated_at.toISOString(),
        }
        : null,
    };

    return res.status(201).json(data);
  } catch {
    return sendError(res, "DB_ERROR");
  }
});

/**
 * PATCH /api/orders/:id/address
 * （既存のまま）
 */
router.patch("/:id/address", async (req: any, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.session.userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, "VALIDATION", "id が不正です");

  try {
    const order = await prisma.order.findFirst({
      where: { id, user_id: userId },
      select: { id: true },
    });
    if (!order) return sendError(res, "VALIDATION", "注文が見つかりません");

    const newAddressId = await resolveAddressId(userId, req.body?.address_id);
    const updated = await prisma.order.update({
      where: { id },
      data: { address_id: newAddressId },
      select: { id: true, address_id: true },
    });
    return res.json(updated);
  } catch {
    return sendError(res, "DB_ERROR");
  }
});

export default router;
