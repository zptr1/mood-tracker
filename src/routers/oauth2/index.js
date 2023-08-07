import { exec$, fetch$ } from "../../db.js";
import { createId } from "../../util.js";
import { getAuth } from "../auth.js";
import express from "express";
import crypto from "crypto";

export const router = express.Router();

export const SCOPES = {
  "identify": "Read your user information",
  "mood.read": "Read your current mood",
  "mood.write": "Update your current mood",
  "history.read": "Read your mood history"
};

const SCOPE_TYPES = Object.keys(SCOPES);

router.get("/authorize", getAuth(true), async (req, res) => {
  if (!req.query.client_id) {
    return res.status(400).render("error/400.ejs", {
      error: "The app did not provide sufficient identification"
    });
  }

  if (!req.query.redirect_uri) {
    return res.status(400).render("error/400.ejs", {
      error: "The app did not provide a redirect URI"
    });
  }

  if (!req.query.response_type || req.query.response_type !== "code") {
    return res.status(400).render("error/400.ejs", {
      error: "The app did not provide a valid response type"
    });
  }

  if (
    !req.query.scope?.length
    || req.query.scope.split(/[-, ]+/g).some((scope) => !SCOPE_TYPES.includes(scope))
  ) {
    return res.status(400).render("error/400.ejs", {
      error: "The app did not provide a valid scope"
    });
  }

  const app = await fetch$(
    "select * from apps where id=$1",
    [req.query.client_id]
  );

  if (!app) {
    return res.status(400).render("error/400.ejs", {
      error: "The app does not exist"
    });
  }

  if (!app.redirect_uris.includes(req.query.redirect_uri)) {
    return res.status(400).render("error/400.ejs", {
      error: "The app did not provide a valid redirect URI"
    });
  }

  return res.render("pages/oauth2/authorize.ejs", {
    user: req.user,
    clientData: app,
    owner: req.user,
    params: {
        redirect_uri: new URL(req.query.redirect_uri),
        response_type: req.query.response_type,
        scope: req.query.scope.split(/[-, ]+/g),
        state: req.query.state,
        editable: req.query.editable === "true",
    },
    scopes: SCOPES,
    url: req.url
  });
});

router.post("/authorize", getAuth(true), async (req, res) => {
  const client = await fetch$(
    "select * from apps where id=$1",
    [req.body.client_id]
  );

  const scopes = Object.keys(req.body)
    .filter((x) => x.startsWith("scopes.") && req.body[x])
    .map((x) => x.slice(7));

  if (!client) {
    return res.render("error/400.ejs", {
      error: "The app does not exist"
    });
  }

  function die(error) {
    return res.render("pages/oauth2/success.ejs", {
      redirect_uri: req.body.redirect_uri,
      error: {
        code: error
      },
      state: req.body.state
    })
  }

  if (!client.redirect_uris.includes(req.body.redirect_uri))
    return die("invalid_redirect_uri");

  if (scopes.some((scope) => !SCOPE_TYPES.includes(scope)))
    return die("invalid_scope");

  if (req.body.response_type !== "code")
    return die("unsupported_response_type");

  const existing = await fetch$(
    "select id from authorized_apps where user_id=$1 and app_id=$2",
    [req.user.id, req.body.client_id]
  );

  // user has already authed, update last authorization
  // !! updating scope to be exclusively the recently requested scopes may not be the best way to do this
  if (existing) {
    await exec$(
      "update authorized_apps set scopes=$1 where id=$2",
      [scopes, existing.id]
    );

    res.render("pages/oauth2/success.ejs", {
      redirect_uri: req.body.redirect_uri,
      state: req.body.state,
      code: existing.id,
      error: null
    });
  } else {
    const id = createId();

    await exec$(
      "insert into authorized_apps values ($1, $2, $3, $4, $5, $6, $7)",
      [
        id,
        crypto.randomBytes(32).toString("base64"),
        crypto.randomBytes(10).toString("base64"),
        scopes,
        Date.now(),
        req.body.client_id,
        req.user.id,
      ]
    );

    res.render("pages/oauth2/success.ejs", {
      redirect_uri: req.body.redirect_uri,
      state: req.body.state,
      error: null,
      code: id
    });
  }
});
