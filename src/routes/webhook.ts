// src/routes/webhook.ts
import { Router } from "express";

const router = Router();

router.post("/shopify", async (req, res) => {
  console.log("✅ Webhook received:", req.body);

  // TODO: 署名検証と保存処理を後で追加
  return res.status(200).json({ received: true });
});

export default router;
