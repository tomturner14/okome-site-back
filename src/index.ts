import express from "express";
import dotenv from "dotenv";
import session from "express-session";
import addressRoutes from "./routes/addresses.js";
import ordersRoutes from "./routes/orders.js";
import authRoutes from "./routes/auth.js";
import usersRouters from "./routes/users.js";
import webhookRoutes from "./routes/webhook.js";
import prisma from "./lib/prisma.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

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

// 認証ルート（ログイン・サインアップ・ログアウト）
app.use("/api/auth", authRoutes);

// 住所・注文・ユーザー関連ルート
app.use("/api/addresses", addressRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/webhook", webhookRoutes);
app.use("/users", usersRouters);

app.get("/", (_req, res) => {
  res.send("okome-site backend is running.");
});

app.listen(PORT, () => {
  console.log(`Server is listening at http://localhost:${PORT}`);
});
