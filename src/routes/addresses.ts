// src/routes/addresses.ts
import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireUser } from "../middlewares/requireUser.js";
import { sendError } from "../lib/errors.js";
import { addressSchema } from "../validators/address.js";

const router = Router();

// 全ルート要ログイン
router.use(requireUser);

/** 住所一覧（既定→古い順） */
router.get("/", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.session.userId as number;

  try {
    const rows = await prisma.userAddress.findMany({
      where: { user_id: userId },
      orderBy: [
        { is_default: "desc" }, // 既定を先頭に
        { created_at: "asc" },  // 古い順
      ],
      select: {
        id: true,
        recipient_name: true,
        postal_code: true,
        address_1: true,
        address_2: true,
        phone: true,
        is_default: true,
        created_at: true,
        updated_at: true,
      },
    });

    // 返却形は従来どおり「配列」
    return res.json(rows);
  } catch {
    return sendError(res, "DB_ERROR");
  }
});

/** 既定住所を1件だけ返す（無ければ最古1件をフォールバック） */
router.get("/default", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.session.userId as number;

  try {
    const def = await prisma.userAddress.findFirst({
      where: { user_id: userId, is_default: true },
      select: {
        id: true,
        recipient_name: true,
        postal_code: true,
        address_1: true,
        address_2: true,
        phone: true,
        is_default: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (def) return res.json({ address: def });

    const first = await prisma.userAddress.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: "asc" },
      select: {
        id: true,
        recipient_name: true,
        postal_code: true,
        address_1: true,
        address_2: true,
        phone: true,
        is_default: true,
        created_at: true,
        updated_at: true,
      },
    });

    return res.json({ address: first ?? null });
  } catch {
    return sendError(res, "DB_ERROR");
  }
});

/** 新規登録（is_default はここでは触らない） */
router.post("/", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.session.userId as number;

  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "VALIDATION", "必須項目が不足しています");
  }

  try {
    const created = await prisma.userAddress.create({
      data: {
        user_id: userId,
        recipient_name: String(parsed.data.recipient_name),
        postal_code: String(parsed.data.postal_code),
        address_1: String(parsed.data.address_1),
        address_2: parsed.data.address_2 ? String(parsed.data.address_2) : "",
        phone: String(parsed.data.phone),
        // is_default は明示的に default 変更APIで設定
      },
      select: {
        id: true,
        recipient_name: true,
        postal_code: true,
        address_1: true,
        address_2: true,
        phone: true,
        is_default: true,
        created_at: true,
        updated_at: true,
      },
    });

    return res.status(201).json(created);
  } catch {
    return sendError(res, "DB_ERROR");
  }
});

/** 更新（通常の項目） */
router.put("/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.session.userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, "VALIDATION", "不正なIDです");

  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, "VALIDATION", "入力内容が不正です");

  try {
    const owned = await prisma.userAddress.findFirst({
      where: { id, user_id: userId },
      select: { id: true },
    });
    if (!owned) return sendError(res, "VALIDATION", "対象が見つかりません");

    const updated = await prisma.userAddress.update({
      where: { id },
      data: {
        recipient_name: String(parsed.data.recipient_name),
        postal_code: String(parsed.data.postal_code),
        address_1: String(parsed.data.address_1),
        address_2: parsed.data.address_2 ? String(parsed.data.address_2) : "",
        phone: String(parsed.data.phone),
      },
      select: {
        id: true,
        recipient_name: true,
        postal_code: true,
        address_1: true,
        address_2: true,
        phone: true,
        is_default: true,
        created_at: true,
        updated_at: true,
      },
    });

    return res.json(updated);
  } catch {
    return sendError(res, "DB_ERROR");
  }
});

/** 既定の配送先に設定（1件のみ true） */
router.put("/:id/default", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.session.userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, "VALIDATION", "不正なIDです");

  try {
    const target = await prisma.userAddress.findFirst({
      where: { id, user_id: userId },
      select: { id: true },
    });
    if (!target) return sendError(res, "VALIDATION", "住所が存在しません");

    const updated = await prisma.$transaction(async (tx) => {
      // まず他を false に
      await tx.userAddress.updateMany({
        where: { user_id: userId, NOT: { id } },
        data: { is_default: false },
      });
      // 対象を true に
      const row = await tx.userAddress.update({
        where: { id },
        data: { is_default: true },
        select: {
          id: true,
          recipient_name: true,
          postal_code: true,
          address_1: true,
          address_2: true,
          phone: true,
          is_default: true,
          created_at: true,
          updated_at: true,
        },
      });
      return row;
    });

    return res.json(updated);
  } catch {
    return sendError(res, "DB_ERROR");
  }
});

/** 削除 */
router.delete("/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.session.userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return sendError(res, "VALIDATION", "不正なIDです");

  try {
    const owned = await prisma.userAddress.findFirst({
      where: { id, user_id: userId },
      select: { id: true },
    });
    if (!owned) return sendError(res, "VALIDATION", "対象が見つかりません");

    await prisma.userAddress.delete({ where: { id } });
    return res.json({ ok: true });
  } catch {
    return sendError(res, "DB_ERROR");
  }
});

export default router;
