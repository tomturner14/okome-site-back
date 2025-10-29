import { Router } from "express";
import { requireUser } from "../middlewares/requireUser.js";
import { sendError } from "../lib/errors.js";

const router = Router();

// 認証必須（ユーザーに紐づく前提）
router.use(requireUser);

// 環境変数
const STOREFRONT_URL = process.env.SHOPIFY_STOREFRONT_URL;   // https://<shop>.myshopify.com/api/2024-10/graphql.json
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN; // Storefront Access Token

if (!STOREFRONT_URL || !STOREFRONT_TOKEN) {
  console.warn("[shopify] SHOPIFY_STOREFRONT_URL / SHOPIFY_STOREFRONT_TOKEN が未設定です");
}

/** Shopify Storefront へ GraphQL を投げる小ヘルパー（詳細ログ付き） */
async function callSF(query: string, variables: Record<string, unknown>) {
  const res = await fetch(STOREFRONT_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN!,
    },
    body: JSON.stringify({ query, variables }),
  });

  const raw = await res.text();
  let json: any;
  try { json = JSON.parse(raw); } catch { json = undefined; }

  return { ok: res.ok, status: res.status, json, raw };
}

/**
 * POST /api/shopify/checkout
 * body: {
 *   lines: { variantId?: string; merchandiseId?: string; id?: string; quantity?: number }[],
 *   email?: string,
 *   note?: string,
 *   shippingAddress?: {
 *     firstName?: string; lastName?: string; address1?: string; address2?: string;
 *     zip?: string; phone?: string; city?: string; province?: string; country?: string;
 *   }
 * }
 * -> { url: string }
 */
router.post("/checkout", async (req, res) => {
  res.set("Cache-Control", "no-store");

  if (!STOREFRONT_URL || !STOREFRONT_TOKEN) {
    return sendError(res, "DB_ERROR", "Shopify 設定が不足しています");
  }

  const bodyLines = Array.isArray(req.body?.lines) ? req.body.lines : [];
  // どのキーでも受け取れるように正規化（merchandiseId / variantId / id の順）
  const lines = bodyLines
    .map((l: any) => ({
      variantId: String(l?.merchandiseId ?? l?.variantId ?? l?.id ?? ""),
      quantity: Number(l?.quantity ?? 1),
    }))
    .filter((l: any) => l.variantId && Number.isFinite(l.quantity) && l.quantity > 0);

  if (lines.length === 0) {
    return sendError(res, "VALIDATION", "lines が不正です（variantId/merchandiseId が必須）");
  }

  // shippingAddress は任意（最低限の項目のみ事前投入）
  const shippingAddress =
    req.body?.shippingAddress && typeof req.body.shippingAddress === "object"
      ? req.body.shippingAddress
      : undefined;

  // 備考は短く切り詰め（例: ユーザーIDの痕跡だけ残す）
  const noteRaw = (req.body?.note ?? `uid:${req.session.userId}`) as string;
  const note = noteRaw.slice(0, 250);

  const query = `
    mutation checkoutCreate($input: CheckoutCreateInput!) {
      checkoutCreate(input: $input) {
        checkout { id webUrl }
        userErrors { field message }
      }
    }
  `;

  const input: Record<string, unknown> = {
    note,
    lineItems: lines, // {variantId, quantity}[]
  };
  if (shippingAddress) input.shippingAddress = shippingAddress;

  try {
    const r = await callSF(query, { input });

    // 通信レベルで非OK → ここで詳細を返す（原因がわかるように）
    if (!r.ok) {
      console.error("[shopify:checkout] HTTP NG", { status: r.status, raw: r.raw });
      if (r.status === 401) {
        return sendError(res, "UNAUTHORIZED", "Shopify 401 Unauthorized。Storefront Access Token / 権限を確認してください。");
      }
      return sendError(
        res,
        "EXTERNAL_API_ERROR",
        `Shopify 応答エラー (${r.status}) ${r.raw?.slice(0, 500)}`
      );
    }

    // GraphQL レスポンスにトップレベル errors がある場合
    if (Array.isArray(r.json?.errors) && r.json.errors.length > 0) {
      console.error("[shopify:checkout] GraphQL errors", r.json.errors);
      return sendError(res, "EXTERNAL_API_ERROR", `GraphQL errors: ${JSON.stringify(r.json.errors).slice(0, 500)}`);
    }

    const payload = r.json?.data?.checkoutCreate;
    const firstErr: string | undefined = payload?.userErrors?.[0]?.message;
    const url: string | undefined = payload?.checkout?.webUrl;

    if (firstErr) {
      // ここは入力の妥当性エラー（例: variantId が販売停止など）
      return sendError(res, "VALIDATION", firstErr);
    }
    if (!url) {
      return sendError(res, "DB_ERROR", "Checkout URL を取得できませんでした");
    }

    return res.json({ url });
  } catch (e: any) {
    console.error("[shopify:checkout] exception", e);
    return sendError(res, "DB_ERROR", "Shopify 連携に失敗しました");
  }
});

export default router;
