// src/lib/errors.ts
import type { Response } from "express";

export type ApiErrorCode =
  | "VALIDATION"          // 入力不正
  | "UNAUTHORIZED"        // 未ログイン / 認証不可
  | "NOT_FOUND"           // 見つからない
  | "DB_ERROR"            // サーバ内部 or DB
  | "EXTERNAL_API_ERROR"; // 上流(Shopify等)のエラー

const statusByCode: Record<ApiErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  // 外部APIの失敗は 502 (Bad Gateway) を採用
  EXTERNAL_API_ERROR: 502,
  DB_ERROR: 500,
};

const defaultMessageByCode: Record<ApiErrorCode, string> = {
  VALIDATION: "入力内容が不正です。",
  UNAUTHORIZED: "認証が必要です。",
  NOT_FOUND: "対象が見つかりません。",
  EXTERNAL_API_ERROR: "外部サービスとの連携でエラーが発生しました。",
  DB_ERROR: "サーバ内部でエラーが発生しました。",
};

export function sendError(
  res: Response,
  code: ApiErrorCode,
  message?: string,
  extra?: unknown
) {
  const status = statusByCode[code] ?? 500;
  return res.status(status).json({
    ok: false,
    code,
    message: message ?? defaultMessageByCode[code],
    ...(extra !== undefined ? { extra } : {}),
  });
}
