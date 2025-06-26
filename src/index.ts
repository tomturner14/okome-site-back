import express from "express";
import dotenv from "dotenv";
import session from "express-session";
import bodyParser from "body-parser";

import addressRoutes from "./routes/addresses.js";
import ordersRoutes from "./routes/orders.js";
import authRoutes from "./routes/auth.js";
import usersRouters from "./routes/users.js";
import webhookRoutes from "./routes/webhook.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use("/api/webhook", bodyParser.raw({ type: "application/json" }));

// ✅ 通常のAPIでは JSON パース
app.use(express.json());

// ✅ セッション設定
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // 本番では true（HTTPSのみ）
      maxAge: 1000 * 60 * 60 * 24, // 1日
    },
  })
);

// ✅ 認証ルート
app.use("/api/auth", authRoutes);

// ✅ その他APIルート
app.use("/api/addresses", addressRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/users", usersRouters);

// ✅ Webhookルート（raw bodyが必要なので最後に）
app.use("/api/webhook", webhookRoutes);

// ✅ 動作確認用ルート
app.get("/", (_req, res) => {
  res.send("okome-site backend is running.");
});

app.listen(PORT, () => {
  console.log(`Server is listening at http://localhost:${PORT}`);
});
