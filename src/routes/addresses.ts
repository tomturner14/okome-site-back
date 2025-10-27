// src/routes/addresses.ts
import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireUser } from "../middlewares/requireUser.js";
import { sendError } from "../lib/errors.js";
import { addressSchema } from "../validators/address.js";

const router = Router();

// 全ルート要ログイン
router.use(requireUser);

// 住所一覧
router.get("/", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.session.userId as number;

  const rows = await prisma.userAddress.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
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
  });

  return res.json(rows);
});

// 住所登録
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
      },
      select: {
        id: true,
        recipient_name: true,
        postal_code: true,
        address_1: true,
        address_2: true,
        phone: true,
      },
    });

    return res.status(201).json(created);
  } catch {
    return sendError(res, "DB_ERROR");
  }
});

// 住所更新
router.put("/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.session.userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return sendError(res, "VALIDATION", "不正な ID です");
  }

  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "VALIDATION", "入力内容が不正です");
  }

  try {
    // 自分のレコードか確認
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
      },
    });

    return res.json(updated);
  } catch {
    return sendError(res, "DB_ERROR");
  }
});

// 住所削除
router.delete("/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.session.userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return sendError(res, "VALIDATION", "不正な ID です");
  }

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
