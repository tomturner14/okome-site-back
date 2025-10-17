import { Router } from "express";
const router = Router();

router.get("/", (req, res) => {
  const { userId, ping } = req.session;
  res.json({
    loggedIn: Boolean(userId),
    sessionPing: typeof ping === "number" ? ping : undefined,
  });
});

export default router;