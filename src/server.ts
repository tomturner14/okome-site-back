// src/server.ts
import express, { type Request } from "express";
import helmet from "helmet";
import webhookRouter from "./routes/webhook"; // ← 追加

const app = express();

// ★ HMAC 用に “生ボディ” を保持（必ず最上流で）
app.use(express.json({
  limit: "10mb",
  verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
    // HMAC検証用に“生ボディ”を保持
    req.rawBody = buf;
  }
}));

app.use(helmet());

// ★ Shopify Webhook を入口で早めにマウント（認証やCSRFの外側でOK）
app.use("/api/webhooks/shopify", webhookRouter);

// 他のルート・ミドルウェアはこの下に（既存があればそのまま）
export default app;
