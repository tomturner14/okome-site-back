import express from "express";
import dotenv from "dotenv";
import session from "express-session";
import bodyParser from "body-parser";
import addressRoutes from "./routes/addresses.js";
import ordersRoutes from "./routes/orders.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import webhookRoutes from "./routes/webhook.js";
import meRoutes from "./routes/me.js";

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use("/api/webhook", bodyParser.raw({ type: "*/*" }));

app.use("/api/webhook", webhookRoutes);

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // 本番では true（HTTPS のみ）
      maxAge: 1000 * 60 * 60 * 24 // 1日
    },
  })
);

// ✅ APIルート
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
