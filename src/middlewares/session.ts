import session from "express-session";
import { RequestHandler } from "express";

const isProduction = process.env.NODE_ENV === "production";

export const sessionMiddleware: RequestHandler = session({
  secret: process.env.SESSION_SECRET || "dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7 //1週間
  }
});