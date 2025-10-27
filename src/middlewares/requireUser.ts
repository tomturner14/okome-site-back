import type { Request, Response, NextFunction } from "express";
import { sendError } from "../lib/errors.js";

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const raw = req.session?.userId;
  const userId = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(userId)) return sendError(res, "UNAUTHORIZED");
  req.session.userId = userId; // number として再格納
  next();
}
