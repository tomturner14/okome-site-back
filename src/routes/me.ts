import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  const sess = req.session as any;
  const loggedIn = Boolean(sess?.userId);
  const sessionPing =
    typeof sess?.ping === "number" ? (sess.ping as number) : undefined;

  res.json({ loggedIn, sessionPing });
});

export default router;