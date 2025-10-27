// src/lib/errors.ts
import type { Response } from "express";

export type ApiErrorCode =
  | "INVALID_EMAIL_OR_PASSWORD"
  | "EMAIL_ALREADY_REGISTERED"
  | "WEAK_PASSWORD"
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "DB_ERROR";

export const ErrorCatalog: Record<ApiErrorCode, { status: number; message: string }> = {
  INVALID_EMAIL_OR_PASSWORD: { status: 401, message: "メールまたはパスワードが違います" },
  EMAIL_ALREADY_REGISTERED: { status: 409, message: "既に登録されています" },
  WEAK_PASSWORD: { status: 400, message: "password は 6 文字以上にしてください" },
  VALIDATION: { status: 400, message: "入力内容が不正です" },
  UNAUTHORIZED: { status: 401, message: "ログインが必要です" },
  DB_ERROR: { status: 500, message: "DB_ERROR" },
};

/**
 * 統一エラーレスポンス
 *  - 例: sendError(res, "VALIDATION", "email と password は必須です");
 */
export function sendError(res: Response, code: ApiErrorCode, overrideMessage?: string) {
  const item = ErrorCatalog[code];
  return res.status(item.status).json({ error: overrideMessage ?? item.message, code });
}
