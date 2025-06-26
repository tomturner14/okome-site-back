import { Router } from "express";
import crypto from "crypto";
import express from "express";
import prisma from "../lib/prisma.js";

const router = Router();
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET!;

router.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256") || "";
  const topic = req.get("X-Shopify-Topic") || "";
  const rawBody = req.body as Buffer;

  const hash = crypto
    .createHmac("sha256", SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody, "utf8")
    .digest("base64");

  const isVerified = hash === hmacHeader;

  if (!isVerified) {
    console.error("Webhook signature mismatch");
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  try {
    const data = JSON.parse(rawBody.toString("utf8"));

    switch (topic) {
      case "orders/create": {
        const order = await prisma.order.create({
          data: {
            shopify_order_id: String(data.id),
            total_price: parseInt(data.total_price),
            ordered_at: new Date(data.created_at),
            cancelled_at: data.cancelled_at ? new Date(data.cancelled_at) : null,
            user_id: null,
            address_id: null,
          },
        });

        const items = data.line_items.map((item: any) => ({
          order_id: order.id,
          product_id: String(item.product_id),
          title: item.title,
          quantity: item.quantity,
          price: parseInt(item.price),
          image_url: "",
        }));

        await prisma.orderItem.createMany({ data: items });

        console.log("✅ Order created:", order.id);
        break;
      }

      case "orders/cancelled": {
        const updated = await prisma.order.updateMany({
          where: {
            shopify_order_id: String(data.id),
          },
          data: {
            cancelled_at: new Date(data.cancelled_at),
          },
        });

        console.log(`✅ Order cancelled: ${data.id}`, updated);
        break;
      }

      case "orders/fulfilled": {
        const updated = await prisma.order.updateMany({
          where: {
            shopify_order_id: String(data.id),
          },
          data: {
            fulfilled_at: new Date(data.fulfillment_status === "fulfilled" ? data.updated_at : null),
          },
        });

        console.log(`✅ Order fulfilled: ${data.id}`, updated);
        break;
      }

      default:
        console.warn("⚠️ Unsupported webhook topic:", topic);
        break;
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
