import { Router } from "express";

const router = Router();

// セッションにpingを数えるだけのシンプルAPI
router.get("/session-ping", (req, res) => {
  // req.sessionは型が厳しいのでanyでOK
  const s = req.session as any;
  s.ping = (s.ping ?? 0) + 1;
  res.json({ ping: s.ping });
});

export default router;