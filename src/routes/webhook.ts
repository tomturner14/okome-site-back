// src/routes/webhook.ts
import { Router } from "express";
import crypto from "crypto";
import prisma from "../lib/prisma.js";

const router = Router();

const HDR_SIG = "X-Shopify-Hmac-Sha256";
const HDR_TOPIC = "X-Shopify-Topic";
const SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || "";

// 金額文字列 → Int（円）
const yen = (v: any): number => {
  if (v == null) return 0;
  const n = Number.parseFloat(String(v));
  if (Number.isNaN(n)) return 0;
  return Math.round(n);
};

const toOrderStatus = (
  financial_status?: string | null
): "pending" | "paid" | "cancelled" => {
  const fs = (financial_status || "").toLowerCase();
  if (fs === "paid") return "paid";
  if (fs === "refunded" || fs === "voided" || fs === "cancelled") return "cancelled";
  return "pending";
};

const toFulfillStatus = (
  fulfillment_status?: string | null
): "unfulfilled" | "fulfilled" => {
  const ff = (fulfillment_status || "").toLowerCase();
  return ff === "fulfilled" ? "fulfilled" : "unfulfilled";
};

router.post("/", async (req, res) => {
  if (!SECRET) return res.status(500).json({ error: "Missing SHOPIFY_WEBHOOK_SECRET" });

  // あなたの index.ts では bodyParser.raw を使うため req.body が Buffer
  // （他環境でも動くよう rawBody → body(Buffer) の順でフォールバック）
  const rawBody: Buffer | undefined =
    (req as any).rawBody ?? (Buffer.isBuffer((req as any).body) ? (req as any).body : undefined);

  const hmacHeader = (req.get(HDR_SIG) || "").trim();
  const topic = (req.get(HDR_TOPIC) || "unknown").trim().toLowerCase();

  if (!rawBody || !hmacHeader) {
    await prisma.webhookLog.create({
      data: { topic, payload: { error: "no rawBody or signature" }, verified: false },
    });
    return res.status(400).json({ error: "Invalid webhook (no raw body or hmac)" });
  }

  // HMAC 検証（生ボディ）
  const expectedB64 = crypto.createHmac("sha256", SECRET).update(rawBody).digest("base64");
  const ok =
    expectedB64.length === hmacHeader.length &&
    crypto.timingSafeEqual(Buffer.from(expectedB64), Buffer.from(hmacHeader));

  // payload は rawBody からのパースを優先（raw運用の一貫性確保）
  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    payload = (req.body && typeof req.body === "object") ? req.body : {};
  }

  // 監査ログ
  await prisma.webhookLog.create({ data: { topic, payload, verified: ok } });

  if (!ok) return res.status(401).json({ error: "Invalid webhook signature" });

  try {
    if (topic === "orders/create" || topic === "orders/paid") {
      const shopifyId: string = String(payload.id);

      // 主要フィールド
      const email: string | null = payload.email ?? payload.contact_email ?? null; // ← 現在は nullable
      const currency: string = payload.currency ?? "JPY";
      const orderNumber: number | null = payload.order_number ?? null;

      const totalPriceYen = yen(payload.total_price ?? payload.current_total_price);
      const orderedAt: Date | null =
        payload.processed_at ? new Date(payload.processed_at)
          : payload.created_at ? new Date(payload.created_at)
            : null;

      const status = toOrderStatus(payload.financial_status);
      const fulfill_status = toFulfillStatus(payload.fulfillment_status);

      const shipping = payload.shipping_address ?? null;
      const shipping_name =
        shipping ? [shipping.first_name, shipping.last_name].filter(Boolean).join(" ") : null;

      const lineItems: any[] = Array.isArray(payload.line_items) ? payload.line_items : [];

      // メール一致で user_id をセット（見つからなければ null）
      const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

      // upsert（冪等）→ items 全削除→再作成
      const order = await prisma.$transaction(async (tx) => {
        const upserted = await tx.order.upsert({
          where: { shopify_order_id: shopifyId },
          create: {
            shopify_order_id: shopifyId,
            order_number: orderNumber ?? undefined,

            user_id: user?.id ?? null,

            email,           // nullable
            currency,
            total_price: totalPriceYen,

            status,
            fulfill_status,

            ordered_at: orderedAt ?? undefined,
            cancelled_at: payload.cancelled_at ? new Date(payload.cancelled_at) : undefined,
            fulfilled_at: payload.closed_at ? new Date(payload.closed_at) : undefined,

            // 配送先スナップショット
            shipping_name,
            shipping_phone: shipping?.phone ?? null,
            shipping_postal_code: shipping?.zip ?? shipping?.postal_code ?? null,
            shipping_address_1: shipping?.address1 ?? null,
            shipping_address_2: shipping?.address2 ?? null,
          },
          update: {
            order_number: orderNumber ?? undefined,

            user_id: user?.id ?? null,

            email,
            currency,
            total_price: totalPriceYen,

            status,
            fulfill_status,

            ordered_at: orderedAt ?? undefined,
            cancelled_at: payload.cancelled_at ? new Date(payload.cancelled_at) : null,
            fulfilled_at: payload.closed_at ? new Date(payload.closed_at) : null,

            shipping_name,
            shipping_phone: shipping?.phone ?? null,
            shipping_postal_code: shipping?.zip ?? shipping?.postal_code ?? null,
            shipping_address_1: shipping?.address1 ?? null,
            shipping_address_2: shipping?.address2 ?? null,
          },
        });

        // Items 入れ替え
        await tx.orderItem.deleteMany({ where: { order_id: upserted.id } });

        if (lineItems.length) {
          await tx.orderItem.createMany({
            data: lineItems.map((li) => {
              const lineId = li.id != null ? String(li.id) : "unknown";
              const productId =
                (li.product_id != null && String(li.product_id)) ||
                (li.variant_id != null && String(li.variant_id)) ||
                (li.sku ? String(li.sku) : `line-${lineId}`);

              return {
                order_id: upserted.id,
                product_id: productId,          // 必須（空は避ける）
                title: li.title ?? "item",
                quantity: Number(li.quantity ?? 1),
                price: yen(li.price),           // 単価（円）
                image_url: li.image?.src ?? null,
              };
            }),
          });
        }

        return upserted;
      });

      // orders/paid なら status を paid に寄せる（保険）
      if (topic === "orders/paid" && order.status !== "paid") {
        await prisma.order.update({
          where: { shopify_order_id: shopifyId },
          data: { status: "paid" },
        });
      }
    }
    else if (topic === "orders/cancelled") {
      const shopifyId = String(payload.id);
      try {
        await prisma.order.update({
          where: { shopify_order_id: shopifyId },
          data: {
            status: "cancelled",
            cancelled_at: payload.cancelled_at ? new Date(payload.cancelled_at) : new Date(),
          },
        });
      } catch {
        await prisma.webhookLog.create({
          data: { topic: "orders/cancelled:missing", payload: { shopifyId }, verified: true },
        });
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
