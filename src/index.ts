import express from "express";
import dotenv from "dotenv";
import usersRouters from "./routes/users.js";
import { sessionMiddleware } from "./middlewares/session.js";
import prisma from "./lib/prisma.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(sessionMiddleware);

// サインアップ
app.post("/api/signup", async (req, res) => {
  try {
    console.log("Signup request:", req.body);
    const { email, password, name, phone } = req.body;

    // バリデーション
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // 既存ユーザーチェック
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // パスワードハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    // ユーザー作成
    const user = await prisma.user.create({
      data: {
        email,
        name,
        hashed_password: hashedPassword,
        phone: phone || null,
      },
    });

    console.log("User created successfully:", user.id);

    res.json({
      success: true,
      message: "User created successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(400).json({ error: "Signup failed", details: error.message });
  }
});

// サインイン
app.post("/api/signin", async (req, res) => {
  try {
    console.log("Signin request:", req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    // ユーザー検索
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // パスワード照合
    const isPasswordValid = await bcrypt.compare(password, user.hashed_password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // セッショントークン生成（簡易版）
    const token = crypto.randomBytes(32).toString('hex');

    console.log("User signed in successfully:", user.id);

    res.json({
      success: true,
      message: "Signin successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone
      },
      token: token
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(400).json({ error: "Signin failed", details: error.message });
  }
});

// ユーザー情報取得
app.get("/api/me", async (req, res) => {
  try {
    // 簡易的な認証チェック（本格的にはJWT等を使用）
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // ここでは簡易版なので、実際のトークン検証は省略
    // 本格的にはJWTやセッションDBで検証

    res.json({
      message: "This endpoint needs proper token validation",
      note: "Add JWT or session-based authentication for production"
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(400).json({ error: "Failed to get user info" });
  }
});

// その他のルーティング
app.use("/users", usersRouters);

app.get("/", (_req, res) => {
  res.send("Hello from okome-backend with bcrypt authentication!");
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:4000`);
  console.log(`📍 Auth endpoints:`);
  console.log(`   - POST /api/signup`);
  console.log(`   - POST /api/signin`);
  console.log(`   - GET /api/me`);
});