import { Request, Response, NextFunction } from "express";

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "ログインが必要です" });
  }
  next();
};