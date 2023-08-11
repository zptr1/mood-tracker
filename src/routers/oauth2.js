import { OAUTH_SCOPES } from "../const.js";
import { exec$, fetch$ } from "../db.js";
import { createId } from "../util.js";
import { getAuth } from "./auth.js";
import express from "express";
import crypto from "crypto";

export const router = express.Router();
const SCOPE_TYPES = Object.keys(OAUTH_SCOPES);

router.get(
  "/authorize", getAuth(true),
  async (req, res) => {
  if (!req.query.client_id) {
    return res.status(400).render("pages/error/400.ejs", {
      error: "The app did not provide sufficient identification"
    });
  }

  if (!req.query.redirect_uri) {
    return res.status(400).render("pages/error/400.ejs", {
      error: "The app did not provide a redirect URI"
    });
  }

  if (!req.query.response_type || req.query.response_type !== "code") {
    return res.status(400).render("pages/error/400.ejs", {
      error: "The app did not provide a valid response type"
    });
  }

  if (
    !req.query.scope?.length
    || req.query.scope
        .split(/[-, ]+/g)
        .some((scope) => !SCOPE_TYPES.includes(scope))
  ) {
    return res.status(400).render("pages/error/400.ejs", {
      error: "The app did not provide a valid scope"
    });
  }

  const app = await fetch$(
    "select * from apps where id=$1",
    [req.query.client_id]
  );

  if (!app) {
    return res.status(400).render("pages/error/400.ejs", {
      error: "The app does not exist"
    });
  }

  if (!app.redirect_uris.includes(req.query.redirect_uri)) {
    return res.status(400).render("pages/error/400.ejs", {
      error: "The app did not provide a valid redirect URI"
    });
  }

  res.header("X-Frame-Options", "DENY");
  res.render("pages/oauth2/authorize.ejs", {
    user: req.user,
    clientData: app,
    owner: await fetch$(
      "select * from users where id=$1",
      [app.owner_id]
    ),
    params: {
      redirect_uri: new URL(req.query.redirect_uri),
      response_type: req.query.response_type,
      scope: [...new Set(req.query.scope.split(/[-, ]+/g))],
      state: req.query.state,
      editable: req.query.editable == "true"
    },
    scopes: OAUTH_SCOPES,
    url: req.url
  });
});

router.post("/authorize", getAuth(true), async (req, res) => {
  const client = await fetch$("select * from apps where id=$1", [
    req.body.client_id
  ]);

  const scopes = [...new Set(Object.keys(req.body))]
    .filter((x) => x.startsWith("scopes.") && req.body[x])
    .map((x) => x.slice(7));

  if (!client) {
    return res.render("pages/error/400.ejs", {
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
    });
  }

  if (!client.redirect_uris.includes(req.body.redirect_uri))
    return die("invalid_redirect_uri");

  if (scopes.some((scope) => !SCOPE_TYPES.includes(scope)))
    return die("invalid_scope");

  if (req.body.response_type !== "code")
    return die("unsupported_response_type");

  const url = new URL(req.body.redirect_uri);

  if (req.body.state)
    url.searchParams.set("state", req.body.state);

  if (req.body.action == "deny") {
    url.searchParams.set("error", "access_denied");
    return res.redirect(url);
  }

  const existing = await fetch$(
    "select id from authorized_apps where user_id=$1 and app_id=$2",
    [req.user.id, req.body.client_id]
  );

  // user has already authed, update last authorization
  // !! updating scope to be exclusively the recently requested scopes may not be the best way to do this
  if (existing) {
    await exec$("update authorized_apps set scopes=$1 where id=$2", [
      scopes,
      existing.id
    ]);

    res.render("pages/oauth2/success.ejs", {
      redirect_uri: url.toString(),
      code: existing.id,
      error: null
    });
  } else {
    // TODO: preventing replay attacks by only allowing the code to be used once
    // > If a code is used more than once, it should be treated as an attack.
    // > If possible, the service should revoke the previous access tokens that were
    // > issued from this authorization code.
    // https://www.oauth.com/oauth2-servers/access-tokens/authorization-code-request/#security-considerations

    // what about a Map of codes stored in a global constant?

    const id = createId();
    await exec$(
      "insert into authorized_apps values ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        id,
        crypto.randomBytes(32).toString("base64"),
        crypto.randomBytes(10).toString("base64"),
        scopes,
        Date.now(),
        req.body.client_id,
        req.user.id,
        req.body.redirect_uri
      ]
    );

    res.render("pages/oauth2/success.ejs", {
      redirect_uri: url,
      error: null,
      code: id
    });
  }
});

router.post("/revoke", getAuth(true), async (req, res) => {
  if (typeof req.body.client_id != "string") {
    return res.status(400).render("pages/error/400.ejs", {
      error: "Invalid app id"
    });
  }

  await exec$(
    "delete from authorized_apps where app_id=$1 and user_id=$2",
    [req.body.client_id, req.user.id]
  );

  res.redirect("/settings/api");
});
