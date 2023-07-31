import config from "../config.json" assert { type: "json" };
import { exec$, fetch$ } from "../db.js";
import { fetchMood, moodInfo } from "../util.js";
import { getAuth } from "./auth.js";
import express from "express";

export const router = express.Router();

router.get("/", getAuth(), async (req, res) => {
  res.render("index", {
    user: req.user
  });
});

router.get("/privacy", (req, res) => {
  res.render("privacy");
})

router.get("/:username", getAuth(), async (req, res, next) => {
  const user = await fetch$(
    "select * from users where username=$1",
    [req.params.username]
  );

  if (!user) return next();
  if (user.is_profile_private && req.user?.id != user.id)
    return next();

  res.render("view", {
    self: req.user?.id == user.id,
    username: user.username,
    mood: await fetchMood(user.id)
  })
});

router.get("/500", (req, res) => {
  // easter egg
  res.status(500).render("500");
})