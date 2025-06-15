// src/validators/order.ts
import { z } from "zod";

export const orderItemSchema = z.object({
  product_id: z.string(),
  title: z.string(),
  quantity: z.number().min(1),
  price: z.number().min(0),
  image_url: z.string().url(),
});

export const orderSchema = z.object({
  address_id: z.number(),
  total_price: z.number().min(0),
  shopify_order_id: z.string(),
  ordered_at: z.string().datetime(), // ISO8601形式前提
  items: z.array(orderItemSchema).min(1),
});

export type OrderInput = z.infer<typeof orderSchema>;
