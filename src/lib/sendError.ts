import type { Response } from "express";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "ALREADY_EXISTS"
  | "DB_ERROR"
  | "INTERNAL_ERROR";

export function sendError(
  res: Response,
  status: number,
  code: ApiErrorCode,
  error: string,
  details?: unknown
) {
  return res.status(status).json({ ok: false, code, error, details });
}
