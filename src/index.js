import errorComments from "../data/error-comments.json" assert { type: "json" };
import express from "express";

import { router as settingsRouter } from "./routers/settings.js";
import { router as apiRouter } from "./routers/api/index.js";
import { router as oauthRouter } from "./routers/oauth2.js";
import { router as authRouter } from "./routers/auth.js";
import { router as appRouter } from "./routers/app.js";

export const router = express.Router();

router.use("/static", express.static("static"));

router.use("/", appRouter);
router.use("/api", apiRouter);
router.use("/auth", authRouter);
router.use("/oauth2", oauthRouter);
router.use("/settings", settingsRouter);

router.use((req, res, next) => res.status(404).render("pages/error/404"));
router.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("pages/error/500", {
    comment: errorComments[Math.floor(Math.random() * errorComments.length)]
  });
});
