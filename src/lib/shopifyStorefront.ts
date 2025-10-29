// src/lib/shopifyStorefront.ts
const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!;
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-07";
const SF_TOKEN = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN!;

if (!STORE_DOMAIN || !SF_TOKEN) {
  // 起動時に気づけるように
  console.warn("[Shopify] Missing env SHOPIFY_STORE_DOMAIN or SHOPIFY_STOREFRONT_ACCESS_TOKEN");
}

async function sfGql<T>(query: string, variables?: any): Promise<T> {
  const endpoint = `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": SF_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    const msg = JSON.stringify(json.errors ?? json, null, 2);
    throw new Error(`Shopify Storefront Error: ${msg}`);
  }
  return json as T;
}

type Line = { merchandiseId: string; quantity: number };

export async function createCheckoutCart(lines: Line[], buyerEmail?: string) {
  const mutation = /* GraphQL */ `
    mutation CartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart { id checkoutUrl }
        userErrors { field message }
      }
    }
  `;
  const input: any = {
    lines: lines.map(l => ({ merchandiseId: l.merchandiseId, quantity: l.quantity })),
  };
  if (buyerEmail) input.buyerIdentity = { email: buyerEmail };

  const resp = await sfGql<{
    data: {
      cartCreate: {
        cart: { id: string; checkoutUrl: string } | null;
        userErrors: { field: string[]; message: string }[];
      };
    };
  }>(mutation, { input });

  const { cart, userErrors } = resp.data.cartCreate;
  if (!cart) {
    throw new Error(`cartCreate failed: ${userErrors.map(e => e.message).join(", ")}`);
  }
  return cart; // { id, checkoutUrl }
}
