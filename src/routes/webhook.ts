import { Router } from "express";
import crypto from "crypto";
import prisma from "../lib/prisma.js";

const router = Router();
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || "";
const HDR_SIG = "X-Shopify-Hmac-Sha256";
const HDR_TOPIC = "X-Shopify-Topic";

router.post("/", async (req, res) => {
  if (!SHOPIFY_WEBHOOK_SECRET) return res.status(500).json({ error: "Missing secret" });

  // Bufferのまま来ているか確認（学習用ログ）
  console.log("isBuffer:", Buffer.isBuffer((req as any).body));

  const hmacHeader = (req.get(HDR_SIG) || "").trim();
  const topic = (req.get(HDR_TOPIC) || "unknown").trim();

  const rawBody = (req as any).body as unknown;
  if (!Buffer.isBuffer(rawBody)) {
    await prisma.webhookLog.create({
      data: { topic, payload: { error: "rawBody not buffer" }, verified: false },
    });
    return res.status(400).json({ error: "Raw body not available" });
  }

  // HMAC生成（Bufferのまま）
  const digest = crypto.createHmac("sha256", SHOPIFY_WEBHOOK_SECRET).update(rawBody).digest("base64");
  const sigBuf = Buffer.from(hmacHeader, "base64");
  const digBuf = crypto.createHmac("sha256", SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest();
  const isVerified = sigBuf.length === digBuf.length && crypto.timingSafeEqual(sigBuf, digBuf);

  // まずはログ保存（検証可否を含めて追跡できるように）
  let payload: any = {};
  try { payload = JSON.parse(rawBody.toString("utf8")); } catch { payload = { raw: rawBody.toString("utf8") }; }
  await prisma.webhookLog.create({ data: { topic, payload, verified: isVerified } });

  if (!isVerified) return res.status(401).json({ error: "Invalid webhook signature" });

  try {
    if (topic === "orders/create") {
      const shopifyId = String(payload.id);
      const customer = payload.customer ?? {};
      const shipping = payload.shipping_address ?? {};
      const email = customer.email ?? `guest+${shopifyId}@example.invalid`;

      await prisma.$transaction(async (tx) => {
        // ユーザーの取得と作成
        let user = await tx.user.findUnique({ where: { email } });
        if (!user) {
          user = await tx.user.create({
            data: {
              email,
              name: `${customer.last_name ?? ""} ${customer.first_name ?? ""}`.trim() || "ゲスト",
              hashed_password: "",
              phone: customer.phone ?? null,
            },
          });
        }

        // 住所の取得と作成
        let address = await tx.userAddress.findFirst({
          where: {
            user_id: user.id,
            postal_code: shipping.zip ?? "",
            address_1: shipping.address1 ?? "",
            address_2: shipping.address2 ?? "",
            recipient_name: shipping.name ?? "",
          },
        });
        if (!address) {
          address = await tx.userAddress.create({
            data: {
              user_id: user.id,
              recipient_name: shipping.name ?? "",
              postal_code: shipping.zip ?? "",
              address_1: shipping.address1 ?? "",
              address_2: shipping.address2 ?? "",
              phone: shipping.phone ?? "",
            },
          });
        }

        // Order（税込JPY整数）※同じ注文が来ても安全
        const order = await tx.order.upsert({
          where: { shopify_order_id: shopifyId },
          update: {
            order_number: payload.order_number,
            total_price: Math.round(Number(payload.total_price)),
            ordered_at: new Date(payload.created_at || Date.now()),
            cancelled_at: payload.cancelled_at ? new Date(payload.cancelled_at) : null,
            user_id: user.id,
            address_id: address.id,
          },
          create: {
            shopify_order_id: shopifyId,
            order_number: payload.order_number,
            total_price: Math.round(Number(payload.total_price)),
            ordered_at: new Date(payload.created_at || Date.now()),
            cancelled_at: payload.cancelled_at ? new Date(payload.cancelled_at) : null,
            user_id: user.id,
            address_id: address.id,
            status: "pending",
            fulfill_status: "unfulfilled",
          },
        });

        // Items（単価を整数円に丸めて保存）
        await tx.orderItem.deleteMany({ where: { order_id: order.id } });
        const items = (payload.line_items ?? []).map((item: any) => ({
          order_id: order.id,
          product_id: String(item.product_id),
          title: item.title,
          quantity: item.quantity,
          price: Math.round(Number(item.price)),
          image_url: "",
        }));
        if (items.length) await tx.orderItem.createMany({ data: items });

        console.log("Order upserted:", order.id);
      });
    }
    else if (topic === "orders/paid") {
      const shopifyId = String(payload.id);
      try {
        await prisma.order.update({
          where: { shopify_order_id: shopifyId },
          data: { status: "paid" },
        });
        console.log("Order paid:", shopifyId);
      } catch {
        await prisma.webhookLog.create({
          data: { topic: "orders/paid:missing", payload: { shopifyId }, verified: true },
        });
        console.warn("orders/paid arrived before create:", shopifyId);
      }
    }
    else if (topic === "orders/cancelled") {
      const shopifyId = String(payload.id);
      try {
        await prisma.order.update({
          where: { shopify_order_id: shopifyId },
          data: {
            status: "cancelled",
            cancelled_at: new Date(payload.cancelled_at || Date.now()),
          },
        });
        console.log("Order cancelled:", shopifyId);
      } catch {
        await prisma.webhookLog.create({
          data: { topic: "orders/cancelled:missing", payload: { shopifyId }, verified: true },
        });
        console.warn("orders/cancelled arrived before create:", shopifyId);
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;