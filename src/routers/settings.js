import { DEFAULT_COLORS, DEFAULT_MOODS, OAUTH_SCOPES } from "../const.js";
import { validateBody } from "./api/util.js";
import { exec$, fetch$ } from "../db.js";
import { createId } from "../util.js";
import { getAuth } from "./auth.js";
import express from "express";
import crypto from "crypto";
import { z } from "zod";

export const router = express.Router();

export const SETTING_CATEGORIES = {
  account: "Account",
  customization: "Customization",
  privacy: "Privacy",
  api: "API"
};

router.use(getAuth(true));
router.use((req, res, next) => {
  res.locals.categories = SETTING_CATEGORIES;
  res.locals.user = {
    ...req.user,
    custom_labels: req.user.custom_labels.length > 0
      ? req.user.custom_labels
      : DEFAULT_MOODS,
    custom_colors: req.user.custom_colors.length > 0
      ? req.user.custom_colors.map((x) => `#${x.toString(16).padStart(6, "0")}`)
      : DEFAULT_COLORS,
    custom_font_size: req.user.custom_font_size || 1.2
  }

  next();
});

router.get("/api/app/:id", async (req, res, next) => {
  const app = await fetch$(
    "select * from apps where id=$1 and owner_id=$2",
    [req.params.id, req.user.id]
  );

  if (!app)
    return next();

  const new_app_secret = req.cookies.new_app_secret;
  if (new_app_secret) res.clearCookie("new_app_secret");

  res.render("pages/settings", {
    category: "api",
    file: "api/view_app",
    new_app_secret,
    app
  });
});

router.get("/api/app/:id/url_generator", async (req, res, next) => {
  const app = await fetch$(
    "select * from apps where id=$1 and owner_id=$2",
    [req.params.id, req.user.id]
  );

  if (!app)
    return next();

  res.render("pages/settings", {
    category: "api",
    file: "api/app_url_generator",
    scopes: OAUTH_SCOPES,
    app
  });
});

router.get("/api/create-app", (req, res) => {
  res.render("pages/settings", {
    category: "api",
    file: "api/create_app"
  });
});

router.post(
  "/api/create-app",
  validateBody({
    name: z.string().min(3).max(32),
    redirect_uri: z.string().max(255).url()
  }),
  async (req, res) => {
    const apps = await fetch$(
      "select count(*) from apps where owner_id=$1",
      [req.user.id]
    );

    if (apps.count >= 10)
      return res.status(400).send(
        "Too many created apps"
      );

    const id = createId();
    const secret = crypto.randomBytes(32).toString("base64url");

    const url = new URL(req.body.redirect_uri);
    url.searchParams.delete("error");
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    url.hash = "";

    await exec$(
      "insert into apps values ($1, $2, $3, $4, $5, $6)",
      [
        id, req.body.name, secret,
        [url.toString()],
        Date.now(),
        req.user.id,
      ]
    );

    res.cookie("new_app_secret", secret);
    res.redirect(`/settings/api/app/${id}`);
  }
);

router.get("/api", async (req, res, next) => {
  const apps = await exec$(
    "select id, name from apps where owner_id=$1",
    [req.user.id]
  );

  const auths = await exec$(
    "select id, app_id, scopes from authorized_apps where user_id=$1",
    [req.user.id]
  );

  const authedApps = await exec$(
    "select id, name from apps where id=any($1)",
    [auths.map((x) => x.app_id)]
  )

  res.locals.apps = apps;
  res.locals.scopes = OAUTH_SCOPES;
  res.locals.auths = auths.map((auth) => ({
    ...auth,
    name: authedApps.find(
      (x) => x.id == auth.app_id
    ).name
  }));

  next();
});

router.get("/:category?", (req, res, next) => {
  const category = req.params.category || "account";

  // need to check for string because javascript moment (__proto__)
  if (typeof SETTING_CATEGORIES[category] != "string")
    return next();

  res.render("pages/settings", {
    category
  });
});