// src/routes/cart.ts
import { Router } from "express";
import { sendError } from "../lib/errors.js";
import { requireUser } from "../middlewares/requireUser.js";

const router = Router();

// 認証（購入者のひも付けを想定。不要なら外してOK）
router.use(requireUser);

const STOREFRONT_URL = process.env.SHOPIFY_STOREFRONT_URL;
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN;

if (!STOREFRONT_URL || !STOREFRONT_TOKEN) {
  console.warn("[cart] SHOPIFY_STOREFRONT_URL / SHOPIFY_STOREFRONT_TOKEN が未設定です");
}

async function sf<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!STOREFRONT_URL || !STOREFRONT_TOKEN) {
    throw new Error("Storefront 設定不足");
  }
  const resp = await fetch(STOREFRONT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!resp.ok) {
    throw Object.assign(new Error(`Shopify ${resp.status}`), { status: resp.status, text: await resp.text() });
  }
  return (await resp.json()) as T;
}

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  lines(first: 50) {
    nodes {
      id
      quantity
      cost {
        amountPerQuantity { amount currencyCode }
        subtotalAmount { amount currencyCode }
      }
      merchandise {
        ... on ProductVariant {
          id
          title
          product { title handle }
          image { url altText }
          price { amount currencyCode }
        }
      }
    }
  }
`;

type LineInput = { variantId: string; quantity: number };

// Create
router.post("/", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const raw = (req.body?.lines ?? []) as LineInput[];
    const lines = Array.isArray(raw)
      ? raw
        .map(l => ({ merchandiseId: String(l.variantId ?? ""), quantity: Number(l.quantity ?? 1) }))
        .filter(l => l.merchandiseId && Number.isFinite(l.quantity) && l.quantity > 0)
      : [];

    const query = `
      mutation CreateCart($lines: [CartLineInput!]) {
        cartCreate(input: { lines: $lines }) {
          cart { ${CART_FIELDS} }
          userErrors { message }
        }
      }
    `;
    const json = await sf<any>(query, { lines });
    const payload = json?.data?.cartCreate;
    const err = payload?.userErrors?.[0]?.message;
    const cart = payload?.cart;
    if (err) return sendError(res, "VALIDATION", err);
    if (!cart) return sendError(res, "DB_ERROR", "Cart を取得できませんでした");
    return res.json(cart);
  } catch {
    return sendError(res, "DB_ERROR", "Shopify 連携に失敗しました");
  }
});

// Get
router.get("/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const id = String(req.params.id);
    const query = `
      query GetCart($id: ID!) {
        cart(id: $id) { ${CART_FIELDS} }
      }
    `;
    const json = await sf<any>(query, { id });
    const cart = json?.data?.cart ?? null;
    if (!cart) return sendError(res, "VALIDATION", "Cart が見つかりません");
    return res.json(cart);
  } catch {
    return sendError(res, "DB_ERROR", "Shopify 連携に失敗しました");
  }
});

// Add lines
router.post("/:id/add", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const id = String(req.params.id);
    const raw = (req.body?.lines ?? []) as LineInput[];
    const lines = Array.isArray(raw)
      ? raw
        .map(l => ({ merchandiseId: String(l.variantId ?? ""), quantity: Number(l.quantity ?? 1) }))
        .filter(l => l.merchandiseId && Number.isFinite(l.quantity) && l.quantity > 0)
      : [];
    if (!lines.length) return sendError(res, "VALIDATION", "lines が不正です");

    const query = `
      mutation AddLines($id: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $id, lines: $lines) {
          cart { ${CART_FIELDS} }
          userErrors { message }
        }
      }
    `;
    const json = await sf<any>(query, { id, lines });
    const payload = json?.data?.cartLinesAdd;
    const err = payload?.userErrors?.[0]?.message;
    if (err) return sendError(res, "VALIDATION", err);
    const cart = payload?.cart;
    return res.json(cart);
  } catch {
    return sendError(res, "DB_ERROR", "Shopify 連携に失敗しました");
  }
});

// Update (単一行の数量更新)
router.post("/:id/update", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const id = String(req.params.id);
    const lineId = String(req.body?.lineId ?? "");
    const quantity = Number(req.body?.quantity ?? 1);
    if (!lineId || !Number.isFinite(quantity)) {
      return sendError(res, "VALIDATION", "lineId / quantity が不正です");
    }

    const query = `
      mutation UpdateLines($id: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $id, lines: $lines) {
          cart { ${CART_FIELDS} }
          userErrors { message }
        }
      }
    `;
    const lines = [{ id: lineId, quantity }];
    const json = await sf<any>(query, { id, lines });
    const payload = json?.data?.cartLinesUpdate;
    const err = payload?.userErrors?.[0]?.message;
    if (err) return sendError(res, "VALIDATION", err);
    return res.json(payload?.cart);
  } catch {
    return sendError(res, "DB_ERROR", "Shopify 連携に失敗しました");
  }
});

// Remove
router.post("/:id/remove", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const id = String(req.params.id);
    const lineIds = Array.isArray(req.body?.lineIds) ? req.body.lineIds.map(String) : [];
    if (!lineIds.length) return sendError(res, "VALIDATION", "lineIds が不正です");

    const query = `
      mutation RemoveLines($id: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $id, lineIds: $lineIds) {
          cart { ${CART_FIELDS} }
          userErrors { message }
        }
      }
    `;
    const json = await sf<any>(query, { id, lineIds });
    const payload = json?.data?.cartLinesRemove;
    const err = payload?.userErrors?.[0]?.message;
    if (err) return sendError(res, "VALIDATION", err);
    return res.json(payload?.cart);
  } catch {
    return sendError(res, "DB_ERROR", "Shopify 連携に失敗しました");
  }
});

export default router;
