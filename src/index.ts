import express from "express";
import dotenv from "dotenv";
import usersRouters from "./routes/users.js"

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// JSONボディをパースできるようにする
app.use(express.json());

// ルーティングを登録する
app.use("/users", usersRouters);

// サーバー動作確認用のエンドポイント
app.get("/", (_req, res) => {
  res.send("Hello from okome-backend!");
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
