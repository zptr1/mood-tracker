import { DEFAULT_MOODS, DEFAULT_COLORS } from "../const.js";
import { exec$, fetch$ } from "../db.js";
import { fetchMood } from "../util.js";
import { getAuth } from "./auth.js";
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
    user: user,
    username: user.username,
    mood: await fetchMood(user),

    labels: user.custom_labels.length > 0
      ? user.custom_labels
      : DEFAULT_MOODS,
    colors: user.custom_colors.length > 0
      ? user.custom_colors.map((x) => `#${x.toString(16).padStart(6, "0")}`)
      : DEFAULT_COLORS,
    font_size: user.custom_font_size || 1.2
  });
});

router.get("/:username/analytics", getAuth(), async (req, res, next) => {
  const user = await fetch$(
    "select * from users where username=$1",
    [req.params.username]
  );

  if (!user) return next();
  if (user.is_profile_private && req.user?.id != user.id)
    return next();
  
  res.render("pages/analytics", {
    username: user.username,
    
    labels: user.custom_labels.length > 0
      ? user.custom_labels
      : DEFAULT_MOODS,
    colors: user.custom_colors.length > 0
      ? user.custom_colors.map((x) => `#${x.toString(16).padStart(6, "0")}`)
      : DEFAULT_COLORS,
    font_size: user.custom_font_size || 1.2
  })
});

router.get("/settings/:category?", getAuth(true), async (req, res, next) => {
  const categories = {
    account: "Account",
    customization: "Customization",
    privacy: "Privacy",
    api: "API"
  };

  if (req.params.category && !Object.keys(categories).includes(req.params.category))
    return next();

  res.render("pages/settings", {
    user: {
      ...req.user,
      custom_labels: req.user.custom_labels.length > 0
        ? req.user.custom_labels
        : DEFAULT_MOODS,
      custom_colors: req.user.custom_colors.length > 0
        ? req.user.custom_colors.map((x) => `#${x.toString(16).padStart(6, "0")}`)
        : DEFAULT_COLORS,
      custom_font_size: req.user.custom_font_size || 1.2
    },
    category: req.params.category || "account",
    categories,
  })
});

router.get("/mydata", getAuth(true), async (req, res) => {
  const history = await exec$(
    "select * from mood where user_id=$1",
    [req.user.id]
  );

  const data = {
    user: {
      username: req.user.username,
      created_at: req.user.created_at,
      total_mood_changes: req.user.stats_mood_sets,
      settings: {
        custom_labels: req.user.custom_labels,
        custom_colors: req.user.custom_colors,
        is_profile_private: req.user.is_profile_private,
        is_history_private: req.user.is_profile_private || req.user.is_history_private
      },
    },
    history: history.map((x) => ({
      timestamp: x.timestamp,
      pleasantness: x.pleasantness,
      energy: x.energy
    }))
  };

  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(data, null, 2));
})

router.get("/500", (req, res) => {
  // easter egg
  res.status(500).render("error/500");
});