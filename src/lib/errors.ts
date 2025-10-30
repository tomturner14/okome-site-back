// src/lib/errors.ts
import type { Response } from "express";

export type ApiErrorCode =
  | "VALIDATION"           // 入力不正
  | "UNAUTHORIZED"         // 未ログイン / 認証不可
  | "FORBIDDEN"            // 権限なし
  | "NOT_FOUND"            // 見つからない
  | "DB_ERROR"             // サーバ内部 or DB
  | "EXTERNAL_API_ERROR";  // 上流(Shopify等)のエラー

const statusByCode: Record<ApiErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  EXTERNAL_API_ERROR: 502,
  DB_ERROR: 500,
};

const defaultMessageByCode: Record<ApiErrorCode, string> = {
  VALIDATION: "入力内容が不正です。",
  UNAUTHORIZED: "ログインが必要です。",
  FORBIDDEN: "権限がありません。",
  NOT_FOUND: "対象が見つかりません。",
  EXTERNAL_API_ERROR: "外部サービス連携でエラーが発生しました。",
  DB_ERROR: "サーバ内部でエラーが発生しました。",
};

export type ApiErrorBody = {
  ok: false;
  code: ApiErrorCode;
  message: string;
  // デバッグや追加情報（画面では使わない）
  extra?: unknown;
};

export function sendError(
  res: Response,
  code: ApiErrorCode,
  message?: string,
  extra?: unknown
) {
  const status = statusByCode[code] ?? 500;
  const body: ApiErrorBody = {
    ok: false,
    code,
    message: message ?? defaultMessageByCode[code] ?? "エラーが発生しました。",
    ...(extra !== undefined ? { extra } : {}),
  };
  return res.status(status).json(body);
}
