import { fetch$ } from "../db.js";
import express from "express";

export const router = express.Router();

export async function getAuth(req, res, next) {
  if (req.headers.authorization) {
    req.user = await fetch$("select * from users where token=$1", [
      req.headers.authorization
    ]);
  }

  if (!req.user) {
    res.status(401).json({
      status: "error",
      message: "Unauthorized"
    })
  } else {
    next();
  }
}

export async function userParamOrAuth(req, res, next) {
  if (req.headers.authorization) {
    req.auth = await fetch$(
      "select * from users where token=$1",
      [req.headers.authorization]
    );
  }

  if (req.params.user) {
    if (!req.params.user.match(/^[a-z0-9_-]{3,32}$/))
      return next();

    req.user = await fetch$(
      "select * from users where username=$1 and ((is_profile_private=false and is_history_private=false) or id=$2)",
      [req.params.user, req.auth?.id ?? -1]
    );
  } else req.user = req.auth;

  if (!req.user) {
    res.status(
      req.params.user ? 404 : 401
    ).json({
      status: "error",
      message: req.params.user
        ? "User not found"
        : "Unauthorized"
    });
  } else {
    next();
  }
}

import { router as prometheusRouter } from "./api/prometheus.js";
import { router as historyRouter } from "./api/history.js";
import { router as moodRouter } from "./api/mood.js";
import { router as meRouter } from "./api/me.js";

router.use("/metrics", prometheusRouter);
router.use("/history", historyRouter);
router.use("/mood", moodRouter);
router.use("/me", meRouter);

router.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route not found"
  });
});
