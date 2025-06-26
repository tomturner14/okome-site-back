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

  let parsedPayload: any;
  try {
    parsedPayload = JSON.parse(rawBody.toString("utf8"));
  } catch (err) {
    await prisma.webhookLog.create({
      data: {
        topic,
        payload: {},
        verified: false,
      },
    });
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  await prisma.webhookLog.create({
    data: {
      topic,
      payload: parsedPayload,
      verified: isVerified,
    },
  });

  if (!isVerified) {
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  try {
    switch (topic) {
      case "orders/create": {
        const customer = parsedPayload.customer;
        const shipping = parsedPayload.shipping_address;

        // ユーザー取得または作成
        let user = await prisma.user.findUnique({
          where: { email: customer.email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: customer.email,
              name: `${customer.last_name ?? ""} ${customer.first_name ?? ""}`.trim(),
              hashed_password: "", // 仮登録のため空文字
              phone: customer.phone ?? null,
            },
          });
        }

        // 住所取得または作成
        let address = await prisma.userAddress.findFirst({
          where: {
            user_id: user.id,
            postal_code: shipping.zip,
            address_1: shipping.address1,
            address_2: shipping.address2,
            recipient_name: shipping.name,
          },
        });

        if (!address) {
          address = await prisma.userAddress.create({
            data: {
              user_id: user.id,
              recipient_name: shipping.name,
              postal_code: shipping.zip,
              address_1: shipping.address1,
              address_2: shipping.address2 ?? "",
              phone: shipping.phone ?? "",
            },
          });
        }

        // 注文作成
        const order = await prisma.order.create({
          data: {
            shopify_order_id: String(parsedPayload.id),
            order_number: parsedPayload.order_number,
            total_price: parseInt(parsedPayload.total_price),
            ordered_at: new Date(parsedPayload.created_at),
            cancelled_at: parsedPayload.cancelled_at ? new Date(parsedPayload.cancelled_at) : null,
            user_id: user.id,
            address_id: address.id,
            status: "pending",
            fulfill_status: "unfulfilled",
          },
        });

        const items = parsedPayload.line_items.map((item: any) => ({
          order_id: order.id,
          product_id: String(item.product_id),
          title: item.title,
          quantity: item.quantity,
          price: parseInt(item.price),
          image_url: "",
        }));

        await prisma.orderItem.createMany({ data: items });

        console.log("Order created:", order.id);
        break;
      }

      // 他の webhook トピック（省略）
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
