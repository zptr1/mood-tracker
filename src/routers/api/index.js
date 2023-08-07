import errorComments from "../../../data/error-comments.json" assert { type: "json" };
import express from "express";

import { router as prometheusRouter } from "./routers/prometheus.js";
import { router as historyRouter } from "./routers/history.js";
import { router as moodRouter } from "./routers/mood.js";
import { router as meRouter } from "./routers/me.js";
import { router as oauth2Router } from "./routers/oauth2.js"

export const router = express.Router();

router.use("/metrics", prometheusRouter);
router.use("/history", historyRouter);
router.use("/mood", moodRouter);
router.use("/me", meRouter);
router.use("/oauth2", oauth2Router);

router.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route not found"
  });
});

router.use((err, req, res) => {
  console.error(err);
  res.status(500).json({
    status: "error",
    message: "Internal server error",
    comment: errorComments[Math.floor(Math.random() * errorComments.length)]
  });
});
