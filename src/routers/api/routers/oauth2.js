import { validateBody } from "../util.js";
import { fetch$ } from "../../../db.js";
import { appAuth } from "../util.js";
import express from "express";
import { z } from "zod";

export const router = express.Router();

router.post(
  "/token", appAuth,
  validateBody(
    {
      grant_type: z.string(),
      code: z.string(),
      redirect_uri: z.string().url()
    }, {
      error: "invalid_request"
    }
  ),
  async (req, res) => {
    if (req.body.grant_type != "authorization_code") {
      return res.status(400).send({
        error: "unsupported_grant_type"
      });
    }

    const auth = await fetch$(
      "select * from authorized_apps where id=$1 and app_id=$2",
      [req.body.code, req.app.id]
    );

    if (!auth || auth.redirect_uri != req.body.redirect_uri) {
      return res.status(400).send({
        error: "invalid_grant"
      });
    }

    res.header("Cache-Control", "no-store").json({
      access_token: auth.access_token,
      token_type: "Bearer",
      scope: auth.scope.join(' '),
    });
  }
);
