// src/routes/webhook.ts
import { Router } from "express";
import crypto from "crypto";

const router = Router();

// 環境変数からWebhookシークレット取得
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET!;

router.post("/", async (req, res) => {
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256") || "";
  const body = JSON.stringify(req.body);

  const hash = crypto
    .createHmac("sha256", SHOPIFY_WEBHOOK_SECRET)
    .update(body, "utf8")
    .digest("base64");

  const isVerified = hash === hmacHeader;

  if (!isVerified) {
    return res.status(401).json({ error: "Webhook signature invalid" });
  }

  // Webhook内容をログ出力（本番では保存や処理へ）
  console.log("✅ Webhook received:", req.body);

  res.status(200).send("OK");
});

export default router;
