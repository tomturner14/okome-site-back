// src/validators/address.ts
import { z } from "zod";

export const addressSchema = z.object({
  recipient_name: z.string().min(1, "宛名は必須です"),
  postal_code: z.string().min(1, "郵便番号は必須です"),
  address_1: z.string().min(1, "住所1は必須です"),
  address_2: z.string().optional(),
  phone: z.string().min(1, "電話番号は必須です"),
});

export type AddressInput = z.infer<typeof addressSchema>;
