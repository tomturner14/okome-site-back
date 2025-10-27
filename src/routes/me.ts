import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

router.get("/", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const sess = req.session as any;
  const raw = sess?.userId;
  const userId = typeof raw === "number" ? raw : Number(raw);
  const loggedIn = Number.isFinite(userId);
  const sessionPing = typeof sess?.ping === "number" ? sess.ping : undefined;

  if (!loggedIn) {
    return res.json({ loggedIn: false, sessionPing, user: null });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    return res.json({ loggedIn: true, sessionPing, user: user ?? null });
  } catch (e) {
    return res.status(500).json({ loggedIn: false, sessionPing, user: null, error: "DB_ERROR" });
  }
});

export default router;