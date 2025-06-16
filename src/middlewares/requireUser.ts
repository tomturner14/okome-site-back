// src/middlewares/requireUser.ts
import { auth } from "../lib/betterAuth.js";
import type { Request, Response, NextFunction } from "express";

export const requireUser = async (req: Request, res: Response, next: NextFunction) => {
  const session = await auth.getSession(req);

  if (!session || !session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.user = session.user; // 以後のAPIで req.user.id が使えるようになる
  next();
};
