import { Router } from "express";
import crypto from "crypto";

const router = Router();

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET!;

router.post("/", async (req, res) => {
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256") || "";

  const body = req.body;
  const hash = crypto
    .createHmac("sha256", SHOPIFY_WEBHOOK_SECRET)
    .update(body, "utf8")
    .digest("base64");

  const isVerified = hash === hmacHeader;

  if (!isVerified) {
    console.error("Webhook signature mismatch");
    return res.status(401).json({ error: "Webhook signature invalid" });
  }

  try {
    const payload = JSON.parse(body.toString("utf8"));
    console.log("✅ Webhook received:", payload);
  } catch (e) {
    console.error("Failed to parse webhook payload");
    return res.status(400).send("Invalid payload");
  }

  res.status(200).send("OK");
});

export default router;
