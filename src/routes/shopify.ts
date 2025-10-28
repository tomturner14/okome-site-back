// src/routes/shopify.ts
import { Router } from "express";
import { requireUser } from "../middlewares/requireUser.js";
import { sendError } from "../lib/errors.js";

const router = Router();

// 認証必須（ユーザーひも付けしたい前提）
router.use(requireUser);

// 環境変数
const STOREFRONT_URL = process.env.SHOPIFY_STOREFRONT_URL; // 例: https://<shop>.myshopify.com/api/2024-10/graphql.json
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN; // Storefront Access Token

if (!STOREFRONT_URL || !STOREFRONT_TOKEN) {
  console.warn(
    "[shopify] SHOPIFY_STOREFRONT_URL / SHOPIFY_STOREFRONT_TOKEN が未設定です"
  );
}

/**
 * POST /api/shopify/checkout
 * body: { lines: { variantId: string, quantity: number }[], email?: string, note?: string, shippingAddress?: {...} }
 * → { url: string }
 */
router.post("/checkout", async (req, res) => {
  res.set("Cache-Control", "no-store");

  if (!STOREFRONT_URL || !STOREFRONT_TOKEN) {
    return sendError(res, "DB_ERROR", "Shopify 設定が不足しています");
  }

  const userId = req.session.userId as number;
  const { lines, email, note, shippingAddress } = (req.body ?? {}) as {
    lines?: Array<{ variantId?: string; quantity?: number }>;
    email?: string;
    note?: string;
    shippingAddress?: Record<string, unknown>; // 任意（CheckoutCreateInput#shippingAddress 互換）
  };

  if (!Array.isArray(lines) || lines.length === 0) {
    return sendError(res, "VALIDATION", "lines は 1 件以上が必要です");
  }
  const normalizedLines = lines
    .map((l) => ({
      variantId: String(l?.variantId ?? ""),
      quantity: Number(l?.quantity ?? 1),
    }))
    .filter((l) => l.variantId && Number.isFinite(l.quantity) && l.quantity > 0);

  if (normalizedLines.length === 0) {
    return sendError(res, "VALIDATION", "line の内容が不正です");
  }

  // Storefront GraphQL: checkoutCreate を使用
  const query = `
    mutation checkoutCreate($input: CheckoutCreateInput!) {
      checkoutCreate(input: $input) {
        checkout { id webUrl }
        userErrors { field message }
      }
    }
  `;

  // checkout の備考に最低限のトレースを残しておく（任意）
  const safeNote = (note ?? "").slice(0, 250);
  const input: Record<string, unknown> = {
    email,
    note: safeNote || `uid:${userId}`, // 例: ユーザーIDをメモ
    lineItems: normalizedLines.map((l) => ({
      variantId: l.variantId,
      quantity: l.quantity,
    })),
  };

  // 任意: 事前に住所を埋めたい場合
  if (shippingAddress && typeof shippingAddress === "object") {
    input.shippingAddress = shippingAddress;
  }

  try {
    const resp = await fetch(STOREFRONT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables: { input } }),
    });

    if (!resp.ok) {
      return sendError(res, "DB_ERROR", `Shopify 応答エラー (${resp.status})`);
    }

    const json = await resp.json();
    const payload = json?.data?.checkoutCreate;
    const firstErr = payload?.userErrors?.[0]?.message as string | undefined;
    const url = payload?.checkout?.webUrl as string | undefined;

    if (firstErr) {
      return sendError(res, "VALIDATION", firstErr);
    }
    if (!url) {
      return sendError(res, "DB_ERROR", "Checkout URL を取得できませんでした");
    }

    return res.json({ url });
  } catch {
    return sendError(res, "DB_ERROR", "Shopify 連携に失敗しました");
  }
});

export default router;
