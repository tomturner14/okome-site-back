import express from "express";
import dotenv from "dotenv";
import session from "express-session";
import bodyParser from "body-parser";
import addressRoutes from "./routes/addresses.js";
import ordersRoutes from "./routes/orders.js";
import authRoutes from "./routes/auth.js";
import usersRouters from "./routes/users.js";
import webhookRoutes from "./routes/webhook.js";
import prisma from "./lib/prisma.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Webhook用（application/json を raw で取得）
app.use("/webhook", bodyParser.raw({ type: "application/json" }));

// 通常のAPI用（JSONをパース）
app.use(express.json());

// セッション設定（bcrypt認証用）
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // 本番では true（HTTPS通信時）
      maxAge: 1000 * 60 * 60 * 24, // 1日
    },
  })
);

// 認証ルート
app.use("/api/auth", authRoutes);

// その他APIルート
app.use("/api/addresses", addressRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/users", usersRouters);
app.use("/webhook", webhookRoutes); // 👈 Webhookルート

// 動作確認用
app.get("/", (_req, res) => {
  res.send("okome-site backend is running.");
});

app.listen(PORT, () => {
  console.log(`Server is listening at http://localhost:${PORT}`);
});
