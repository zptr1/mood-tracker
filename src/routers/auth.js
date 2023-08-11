import config from "../../config.json" assert { type: "json" };
import { exec$, fetch$ } from "../db.js";
import { randomBytes } from "crypto";
import express from "express";
import bcrypt from "bcrypt";

export const router = express.Router();

export function getAuth(required=false) {
  return async function (req, res, next) {
    if (req.cookies.token) {
      req.user = await fetch$("select * from users where token=$1", [
        req.cookies.token
      ]);
    }

    if (required && !req.user) {
      res.status(401).redirect("/auth/login");
    } else {
      next();
    }
  }
}

router.get("/login", (req, res) => res.render("pages/auth/login"));
router.get("/register", (req, res) => res.render("pages/auth/register", {
  turnstile_site_key: config.turnstile.site_key
}));

router.get("/logout", (req, res) => {
  res.clearCookie("token").redirect("/");
})

router.post("/login", async (req, res) => {
  if (typeof req.body.username != "string" || typeof req.body.password != "string")
    return res.status(400).send("Bad Request");

  const user = await fetch$("select * from users where username=$1", [req.body.username]);
  if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) {
    return res.status(403).render("pages/auth/login", {
      error: "Invalid username or password"
    });
  }

  res.cookie("token", user.token, {
    maxAge: 365 * 24 * 3600 * 1000
  }).redirect("/");
});

router.post("/register", async (req, res) => {
  if (
    typeof req.body.username != "string"
    || typeof req.body.password != "string"
    || typeof req.body["cf-turnstile-response"] != "string"
  ) {
    return res.status(400).send("Bad Request");
  }

  if (!req.body.username.match(/^[a-z0-9_-]{3,32}$/)) {
    return res.status(400).render("pages/auth/register", {
      error: "Username validation failed",
      turnstile_site_key: config.turnstile.site_key
    });
  }

  if (config.blacklisted_usernames.includes(req.body.username)) {
    return res.status(400).render("pages/auth/register", {
      error: "You cannot use that username",
      turnstile_site_key: config.turnstile.site_key
    });
  }

  if (await fetch$("select 1 from users where username=$1", [req.body.username])) {
    return res.status(409).render("pages/auth/register", {
      error: "Username taken",
      turnstile_site_key: config.turnstile.site_key
    });
  }

  if (config.turnstile.site_key) {
    const captcha = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: config.turnstile.secret_key,
        response: req.body["cf-turnstile-response"],
        remoteip: req.headers["cf-connecting-ip"]
      })
    });

    if (!(await captcha.json()).success) {
      return res.status(401).render("pages/auth/register", {
        error: "Captcha failed, retry again please!",
        turnstile_site_key: config.turnstile.site_key
      });
    }
  }

  const hash = await bcrypt.hash(req.body.password, 10);
  const token = randomBytes(48).toString("base64url");

  await exec$(
    "insert into users values (default, $1, $2, $3, $4)",
    [req.body.username, hash, token, Date.now()]
  );

  res.cookie("token", token, {
    maxAge: 365 * 24 * 3600 * 1000
  }).redirect("/");
});
