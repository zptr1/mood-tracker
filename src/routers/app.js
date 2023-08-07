import { DEFAULT_MOODS, DEFAULT_COLORS } from "../const.js";
import { exec$, fetch$ } from "../db.js";
import { fetchMood } from "../util.js";
import { getAuth } from "./auth.js";
import express from "express";
import {validateBody} from "./api/util.js";
import {z} from "zod";
import crypto from "crypto";

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

const categories = {
  account: "Account",
  customization: "Customization",
  privacy: "Privacy",
  api: "API"
};

router.get("/settings/api/create-app", getAuth(true), (req, res) => {
  res.render("pages/oauth2/create-app", {
    user: {
      ...req.user,
      custom_labels:
          req.user.custom_labels.length > 0
              ? req.user.custom_labels
              : DEFAULT_MOODS,
      custom_colors:
          req.user.custom_colors.length > 0
              ? req.user.custom_colors.map(
                  (x) => `#${x.toString(16).padStart(6, "0")}`,
              )
              : DEFAULT_COLORS,
      custom_font_size: req.user.custom_font_size || 1.2,
    },
    category: req.params.category || "api",
    categories,
  });
});

router.post("/settings/api/create-app", getAuth(true), async (req, res) => {
  function die(msg) {
    res.status(400).render("pages/oauth2/create-app", {
      user: {
        ...req.user,
        custom_labels:
            req.user.custom_labels.length > 0
                ? req.user.custom_labels
                : DEFAULT_MOODS,
        custom_colors:
            req.user.custom_colors.length > 0
                ? req.user.custom_colors.map(
                    (x) => `#${x.toString(16).padStart(6, "0")}`,
                )
                : DEFAULT_COLORS,
        custom_font_size: req.user.custom_font_size || 1.2,
      },
      category: req.params.category || "api",
      categories,
      error: msg,
      values: {
        name: req.body.name,
        redirect_uri: req.body.redirect_uri,
      },
    });
  }

  if (!req.body.name || !req.body.redirect_uri) {
    return die("Missing required fields.");
  }

  if (req.body.name?.length > 32) {
    return die("Name must be less than 32 characters long.");
  }

  try {
    const url = new URL(req.body.redirect_uri);

    // TODO: uncomment this if we decide HTTPS is required
    // if (url.protocol !== 'https:') {
    //   return die("Redirect URI must be HTTPS.");
    // }
  } catch {
    return die("Invalid redirect URI.");
  }

  // schema:
  /*
  create table if not exists apps (
  id varchar(16) primary key,
  name varchar(32),
  secret varchar(64) unique,
  redirect_uris varchar(255)[],
  created_at bigint,

  owner_id int references users(id) on delete cascade
);
   */
  await exec$(
      "insert into apps (id, name, secret, redirect_uris, created_at, owner_id) values ($1, $2, $3, $4, $5, $6) returning *",
      [
        // 16 chars
        crypto.getRandomValues(new Uint8Array(6)).join(""),
        req.body.name,
        // 64 chars
        crypto.getRandomValues(new Uint8Array(16)).join(""),
        [req.body.redirect_uri],
        Date.now(),
        req.user.id,
      ],
  );

  return res.redirect("/settings/api");
});

router.get("/settings/:category?", getAuth(true), async (req, res, next) => {
  if (req.params.category && !Object.keys(categories).includes(req.params.category))
    return next();

  const extras = {}

  if (req.params.category === "api") {
    const apps = await fetch$(
        "select * from apps where owner_id=$1",
        [req.user.id]
    ) ?? [];
    const authed = await fetch$(
        "select * from authorized_apps where user_id=$1",
        [req.user.id]
    ) ?? [];

    extras.apps = Array.isArray(apps) ? apps : [apps]
    extras.authed = Array.isArray(authed) ? authed : [authed]

    console.log(apps, authed)
  }

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
    extras
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
