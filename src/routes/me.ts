import { Router } from "express";
import prisma from ".../lib/prisma.js";
import { m } from "node_modules/better-auth/dist/shared/better-auth.BTuiucL9.js";

const router = Router();

router.get("/orders", async (req, res) => {
  const user = req.session.user;

  //ログインしていない場合はエラー
  if (!user) {
    return res.status(401).json({ error: "ログインが必要です" });
  }

  const orders = await prisma.order.findMany({
    where: { user_id: user.id },
    include: { items: true },
    orderBy: { ordered_at: "desc" },
  });
})