import express from "express";
import dotenv from "dotenv";
import cookieSession from "cookie-session";
import bodyParser from "body-parser";
import cors from "cors";

import addressRoutes from "./routes/addresses.js";
import ordersRoutes from "./routes/orders.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import webhookRoutes from "./routes/webhook.js";
import meRoutes from "./routes/me.js";
import devRoutes from "./routes/dev.js";

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

// Webhook(raw)を最優先
app.use(["/api/webhook", "/webhook"], bodyParser.raw({ type: "*/*", limit: "2mb" }));
app.use(["/api/webhook", "/webhook"], webhookRoutes);

// CORS有効化（通常API用）
const ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";
app.use(cors({ origin: ORIGIN, credentials: true }));

// 通常リクエストのJSONパース
app.use(express.json());

app.use(
  cookieSession({
    name: "okome.sid",
    keys: [process.env.SESSION_SECRET!],
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
  })
);

app.use((req, _res, next) => {
  if (!req.session) req.session = {} as any;
  next();
});

app.use("/api/dev", devRoutes);

// APIルート
app.use("/api/auth", authRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/me", meRoutes);

app.get("/", (_req, res) => {
  res.send("okome-site backend is running.");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is listening at http://0.0.0.0:${PORT}`);
});
