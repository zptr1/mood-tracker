import { fetchMood, DEFAULT_MOODS, DEFAULT_COLORS } from "../util.js";
import { getAuth } from "./auth.js";
import { fetch$ } from "../db.js";
import express from "express";

export const router = express.Router();

router.get("/", getAuth(), async (req, res) => {
  res.render("pages/index", {
    user: req.user
  });
});

router.get("/privacy", (req, res) => {
  res.render("pages/privacy");
})

router.get("/:username", getAuth(), async (req, res, next) => {
  const user = await fetch$(
    "select * from users where username=$1",
    [req.params.username]
  );

  if (!user) return next();
  if (user.is_profile_private && req.user?.id != user.id)
    return next();

  res.render("pages/view", {
    self: req.user?.id == user.id,
    username: user.username,
    mood: await fetchMood(user),

    labels: user.custom_labels.length > 0
      ? user.custom_labels
      : DEFAULT_MOODS,
    colors: user.custom_colors.length > 0
      ? user.custom_colors.map((x) => `#${x.toString(16).padStart(6, "0")}`)
      : DEFAULT_COLORS
  });
});

router.get("/settings/:category?", getAuth(true), async (req, res, next) => {
  const categories = ["account", "customization", "privacy"];
  if (req.params.category && !categories.includes(req.params.category))
    return next();

  res.render("pages/settings", {
    user: {
      ...req.user,
      custom_labels: req.user.custom_labels.length > 0
        ? req.user.custom_labels
        : DEFAULT_MOODS,
      custom_colors: req.user.custom_colors.length > 0
        ? req.user.custom_colors.map((x) => `#${x.toString(16).padStart(6, "0")}`)
        : DEFAULT_COLORS
    },
    category: req.params.category || "account",
    categories,
  })
})

router.get("/500", (req, res) => {
  // easter egg
  res.status(500).render("error/500");
});