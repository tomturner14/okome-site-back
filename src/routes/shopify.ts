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
// src/routes/shopify.ts から抜粋（/checkout ハンドラを置き換え）

router.post("/checkout", async (req, res) => {
  res.set("Cache-Control", "no-store");

  if (!STOREFRONT_URL || !STOREFRONT_TOKEN) {
    return sendError(res, "DB_ERROR", "Shopify 設定が不足しています");
  }

  // --- 入力の正規化 ---
  const raw = (req.body ?? {}) as {
    lines?: Array<{ variantId?: string; merchandiseId?: string; id?: string; quantity?: number }>;
    email?: string;
    note?: string; // 使わないが互換で受け取る
    shippingAddress?: Record<string, unknown>;
  };

  if (!Array.isArray(raw.lines) || raw.lines.length === 0) {
    return sendError(res, "VALIDATION", "lines が不正です（variantId/merchandiseId が必須）");
  }

  // merchandiseId（= ProductVariant の GID）にそろえる
  const normLines = raw.lines
    .map((l) => {
      const id =
        (l.merchandiseId as string) ||
        (l.variantId as string) ||
        (l.id as string) ||
        "";
      const qty = Number(l.quantity ?? 1);
      return { merchandiseId: id, quantity: qty };
    })
    .filter((l) => l.merchandiseId && Number.isFinite(l.quantity) && l.quantity > 0);

  if (normLines.length === 0) {
    return sendError(res, "VALIDATION", "lines が不正です（数量が不正など）");
  }

  // --- GraphQL: cartCreate を使用 ---
  const query = /* GraphQL */ `
    mutation CartStart($input: CartInput) {
      cartCreate(input: $input) {
        cart {
          id
          checkoutUrl
        }
        userErrors {
          field
          code
          message
        }
      }
    }
  `;

  // shippingAddress を CartInput の deliveryAddressPreferences にマッピング
  const sa = raw.shippingAddress;
  const deliveryPref =
    sa && typeof sa === "object"
      ? [
        {
          deliveryAddress: {
            firstName: (sa as any).firstName ?? (sa as any).givenName ?? "",
            lastName: (sa as any).lastName ?? (sa as any).familyName ?? "",
            address1: (sa as any).address1 ?? "",
            address2: (sa as any).address2 ?? "",
            // 必要に応じて city/province/country/zip を付与
            city: (sa as any).city ?? "",
            province: (sa as any).province ?? "",
            country: (sa as any).country ?? "JP",
            zip: (sa as any).zip ?? (sa as any).postalCode ?? "",
            phone: (sa as any).phone ?? "",
          },
        },
      ]
      : undefined;

  const input: Record<string, unknown> = {
    lines: normLines, // ← CartLineInput の配列
    buyerIdentity: raw.email ? { email: raw.email } : undefined,
    deliveryAddressPreferences: deliveryPref,
    // note は CartInput には無いので付けない（必要なら order メタで）
  };

  try {
    const resp = await fetch(STOREFRONT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables: { input } }),
    });

    const json = await resp.json();

    // GraphQL レベルの errors（配列）も見ておく
    if (json?.errors?.length) {
      const m = json.errors.map((e: any) => e.message).join("; ");
      console.error("[shopify:checkout] GraphQL errors", json.errors);
      return sendError(res, "EXTERNAL_API_ERROR", m || "Shopify GraphQL error");
    }

    const payload = json?.data?.cartCreate;
    const firstErr = payload?.userErrors?.[0]?.message as string | undefined;
    const url = payload?.cart?.checkoutUrl as string | undefined;

    if (firstErr) {
      return sendError(res, "VALIDATION", firstErr);
    }
    if (!url) {
      return sendError(res, "DB_ERROR", "Checkout URL を取得できませんでした");
    }

    return res.json({ url });
  } catch (e) {
    console.error(e);
    return sendError(res, "DB_ERROR", "Shopify 連携に失敗しました");
  }
});

export default router;
