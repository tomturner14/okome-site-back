import { Router } from "express";
import crypto from "crypto";
import prisma from "../lib/prisma.js";

const router = Router();

function verifyShopifyWebhook(req: any, secret: string): boolean {
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256") as string;
  const body = req.rawBody;

  const hash = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64");

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
}

// 生のリクエストボディ取得用（index.ts 側で app.use(express.raw()) を使う）
router.post("/order", async (req, res) => {
  const rawBody = req.body.toString("utf8");
  const verified = verifyShopifyWebhook({ get: req.get.bind(req), rawBody }, process.env.SHOPIFY_WEBHOOK_SECRET!);

  if (!verified) {
    return res.status(401).json({ error: "署名検証に失敗しました" });
  }

  try {
    const order = JSON.parse(rawBody);

    const savedOrder = await prisma.order.create({
      data: {
        user_id: 1, // ← Shopifyにログイン連携しない場合は固定で問題なし
        address_id: 1,
        shopify_order_id: order.id.toString(),
        total_price: parseInt(order.total_price),
        ordered_at: new Date(order.created_at),
        items: {
          create: order.line_items.map((item: any) => ({
            product_id: item.product_id?.toString() || "unknown",
            title: item.title,
            quantity: item.quantity,
            price: parseInt(item.price),
            image_url: item.image || "",
          })),
        },
      },
      include: { items: true },
    });

    res.status(200).json({ success: true, order: savedOrder });
  } catch (e: any) {
    console.error("注文保存エラー:", e);
    res.status(500).json({ error: "注文保存に失敗しました" });
  }
});

export default router;
