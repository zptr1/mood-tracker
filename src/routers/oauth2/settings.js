// todo: move this to specific api routes

import { DEFAULT_COLORS, DEFAULT_MOODS, SETTING_CATEGORIES } from "../../const.js";
import { exec$, fetch$ } from "../../db.js";
import { createId, safeParseURL } from "../../util.js";
import { getAuth } from "../auth.js";
import express from "express";
import crypto from "crypto";

export const router = express.Router();

router.get("/create-app", getAuth(true), (req, res) => {
  res.render("pages/oauth2/create-app", {
    user: {
      ...req.user,
      custom_labels: req.user.custom_labels.length > 0
        ? req.user.custom_labels
        : DEFAULT_MOODS,
      custom_colors: req.user.custom_colors.length > 0
        ? req.user.custom_colors.map((x) => `#${x.toString(16).padStart(6, "0")}`)
        : DEFAULT_COLORS,
      custom_font_size: req.user.custom_font_size || 1.2,
    },
    category: req.params.category || "api",
    categories: SETTING_CATEGORIES
  });
});

router.post("/create-app", getAuth(true), async (req, res) => {
  function die(msg) {
    res.status(400).render("pages/oauth2/create-app", {
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
      category: req.params.category || "api",
      categories: SETTING_CATEGORIES,
      error: msg,
      values: {
        name: req.body.name,
        redirect_uri: req.body.redirect_uri,
      },
    });
  }

  if (!req.body.name || !req.body.redirect_uri)
    return die("Missing required fields.");

  if (req.body.name?.length > 32)
    return die("Name must be less than 32 characters long.");

  const url = safeParseURL(req.body.redirect_uri);
  
  if (!url)
    return die("Invalid redirect URI.");

  url.searchParams.delete("error");
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.hash = "";

  await exec$(
    "insert into apps values ($1, $2, $3, $4, $5, $6)",
    [
      createId(),
      req.body.name,
      crypto.randomBytes(32).toString("base64"),
      [url.toString()],
      Date.now(),
      req.user.id,
    ]
  );

  return res.redirect("/settings/api");
});

router.post("/delete-app", getAuth(true), async (req, res) => {
  if (
    typeof req.body.app_id != "string"
    || !await fetch$(
      "select 1 from apps where id=$1 and owner_id=$2",
      [req.body.app_id, req.user.id]
    )
  ) {
    return res.status(400).render("error/400", {
      error: "Invalid application ID",
    });
  }

  await exec$(
    "delete from apps where id = $1 and owner_id = $2",
    [app_id, req.user.id]
  );

  return res.redirect("/settings/api");
});

router.get("/delete-app", getAuth(true), async (req, res) => {
  return res.redirect("/settings/api");
});
