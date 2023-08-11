import { fetch$, exec$ } from "../../../db.js";
import { createId } from "../../../util.js";
import { validateBody } from "../util.js";
import { auth } from "../util.js";
import express from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { z } from "zod";

export const router = express.Router();

router.get(
  "/", auth(),
  async (req, res) => {
    const apps = await exec$(
      "select * from apps where owner_id=$1",
      [req.user.id]
    );

    res.json({
      status: "ok",
      apps: apps.map((x) => ({
        id: x.id,
        name: x.name,
        redirect_uris: x.redirect_uris
      }))
    })
  }
);

router.post(
  "/", auth(),
  validateBody({
    name: z.string().min(3).max(32),
    redirect_uris: z.array(z.string().max(255).url())
      .min(1).max(5)
  }),
  async (req, res) => {
    const id = createId();
    const secret = crypto.randomBytes(32).toString("base64url");

    const urls = req.body.redirect_uris
      .map((x) => new URL(x));

    const apps = await fetch$(
      "select count(*) from apps where owner_id=$1",
      [req.user.id]
    );

    if (apps.length >= 10) {
      return res.status(400).json({
        status: "error",
        message: "Too many created apps"
      });
    }

    urls.forEach((url) => {
      url.searchParams.delete("error");
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      url.hash = "";
    });

    await exec$(
      "insert into apps values ($1, $2, $3, $4, $5, $6)",
      [
        id, req.body.name, secret,
        urls, Date.now(), req.user.id,
      ]
    );

    res.json({
      status: "ok",
      id, secret
    });
  }
);

router.patch(
  "/:id", auth(),
  validateBody({
    redirect_uris: z.array(z.string().max(250).url())
      .min(1).max(5)
  }),
  async (req, res, next) => {
    if (!req.params.id.match(/^[a-z\d]{16}$/))
      return next();

    const urls = req.body.redirect_uris
      .map((x) => new URL(x));

    urls.forEach((url) => {
      url.searchParams.delete("error");
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      url.hash = "";
    });

    if (!await fetch$("select 1 from apps where owner_id=$1 and id=$2", [req.user.id, req.params.id])) {
      return res.status(404).json({
        status: "error",
        message: "Unknown application"
      });
    }

    await exec$(
      "update apps set redirect_uris=$1 where id=$2",
      [
        [...new Set(urls.map((x) => x.toString()))],
        req.params.id
      ]
    );

    res.json({
      status: "ok"
    });
  }
);

router.delete(
  "/:id", auth(),
  validateBody({
    password: z.string().min(1)
  }),
  async (req, res, next) => {
    if (!req.params.id.match(/^[a-z\d]{16}$/))
      return next();

    if (!await fetch$("select 1 from apps where owner_id=$1 and id=$2", [req.user.id, req.params.id])) {
      return res.status(404).json({
        status: "error",
        message: "Unknown application"
      });
    }

    if (!await bcrypt.compare(req.body.password, req.user.password_hash)) {
      return res.status(401).json({
        status: "error",
        message: "Passwords do not match"
      })
    }

    await exec$(
      "delete from apps where id=$1",
      [req.params.id]
    );

    res.json({
      status: "ok"
    });
  }
);

router.patch(
  "/:id/secret", auth(),
  validateBody({
    password: z.string().min(1)
  }),
  async (req, res, next) => {
    if (!req.params.id.match(/^[a-z\d]{16}$/))
      return next();

    if (!await fetch$("select 1 from apps where owner_id=$1 and id=$2", [req.user.id, req.params.id])) {
      return res.status(404).json({
        status: "error",
        message: "Unknown application"
      });
    }

    if (!await bcrypt.compare(req.body.password, req.user.password_hash)) {
      return res.status(401).json({
        status: "error",
        message: "Passwords do not match"
      })
    }

    const secret = crypto.randomBytes(32).toString("base64url");

    await exec$(
      "update apps set secret=$1 where id=$2",
      [secret, req.params.id]
    );

    res.json({
      status: "ok",
      secret
    });
  }
)

router.get(
  "/authorized", auth(),
  async (req, res) => {
    const authed = await exec$(
      "select app_id, scopes from authorized_apps where user_id=$1",
      [req.user.id]
    );

    const apps = await exec$(
      "select id, name from apps where id=any($1)",
      [authed.map((x) => x.app_id)]
    );

    res.json({
      status: "ok",
      apps: authed.map((auth) => ({
        ...apps.find((x) => x.id == auth.app_id),
        scopes: auth.scopes,
      }))
    });
  }
);

router.delete(
  "/authorized/:id", auth(),
  async (req, res, next) => {
    if (!req.params.id.match(/^[a-z\d]{16}$/))
      return next();

    if (!await fetch$("select 1 from authorized_apps where user_id=$1 and app_id=$2", [req.user.id, req.params.id])) {
      return res.status(404).json({
        status: "error",
        message: "Unknown application"
      });
    }

    await exec$(
      "delete from authorized_apps where user_id=$1 and app_id=$2",
      [req.user.id, req.params.id]
    );

    res.json({
      status: "ok"
    });
  }
)
