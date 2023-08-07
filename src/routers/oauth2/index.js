import express from "express";
import { getAuth } from "../auth.js";
import { exec$, fetch$ } from "../../db.js";
import {validateQuery} from "../api/util.js";
import {nanoid} from "nanoid";
import {randomBytes} from "crypto";

export const router = express.Router();

export const SCOPES = {
    user: "Read your user information",

    mood: "Read and update your current mood",
    "mood.read": "Read your current mood",
    "mood.write": "Update your current mood",

    "history.read": "Read your mood history",
};
const SCOPE_KEYS = Object.keys(SCOPES);

//#region Frontend

router.get("/authorize", getAuth(true), async (req, res) => {
    if (!req.query.client_id) {
        return res.status(400).render("error/oauth2.ejs", {
            error: "The client did not provide sufficient identification",
        });
    }

    if (!req.query.redirect_uri) {
        return res.status(400).render("error/oauth2.ejs", {
            error: "The client did not provide a redirect URI",
        });
    }

    if (!req.query.response_type || req.query.response_type !== "code") {
        return res.status(400).render("error/oauth2.ejs", {
            error: "The client did not provide a valid response type",
        });
    }

    if (
        !req.query.scope?.length ||
        req.query.scope
            .split(/[-, ]+/g)
            .some((scope) => !SCOPE_KEYS.includes(scope))
    ) {
        return res.status(400).render("error/oauth2.ejs", {
            error: "The client did not provide a valid scope",
        });
    }

    const client = await fetch$("select * from apps where id=$1", [
        req.query.client_id,
    ]);

    if (!client) {
        return res.status(400).render("error/oauth2.ejs", {
            error: "The client does not exist",
        });
    }

    if (!client.redirect_uris.includes(req.query.redirect_uri)) {
        return res.status(400).render("error/oauth2.ejs", {
            error: "The client did not provide a valid redirect URI",
        });
    }

    return res.render("pages/oauth2/authorize.ejs", {
        user: req.user,
        clientData: client,
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
    if (
        !req.body.client_id ||
        !req.body.redirect_uri
    ) {
        return res.render("error/oauth2.ejs", {
            error: "The client did not provide sufficient identification",
        })
    }

    const client = await fetch$("select * from apps where id=$1", [
        req.body.client_id,
    ]);

    // catch this edge case
    if (!client) {
        return res.render("error/oauth2.ejs", {
            error: "The client does not exist",
        })
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

    function success(code) {
        return res.render("pages/oauth2/success.ejs", {
            redirect_uri: req.body.redirect_uri,
            code,
            error: null,
            state: req.body.state
        })
    }

    if (!client.redirect_uris.includes(req.body.redirect_uri)) {
        return res.render("error/oauth2.ejs", {
            error: "The client did not provide a valid redirect URI",
        })
    }

    const scopes = Object.keys(req.body)
        .filter((s) => s.startsWith("scopes."))
        .map((s) => s.slice(7));

    if (scopes.some((scope) => !SCOPE_KEYS.includes(scope))) {
        return die("invalid_scope");
    }

    if (req.body.response_type !== "code") {
        return die("unsupported_response_type");
    }

    const already = await fetch$(
        "select 1 from authorized_apps where user_id=$1 and app_id=$2",
        [req.user.id, req.body.client_id],
    );

    // user has already authed, update last authorization
    // !! updating scope to be exclusively the recently requested scopes may not be the best way to do this
    if (already) {
        const authorizations = await exec$(
            "update authorized_apps set scopes=$1 where user_id=$2 and app_id=$3 returning *",
            [scopes, req.user.id, req.body.client_id],
        );

        if (authorizations.length > 1) {
            return die("server_error")
        } else {
            return success(authorizations[0].id);
        }
    } else {
        // we have to create a new authorization
        const newAuth = await exec$(
            "insert into authorized_apps (id, user_id, app_id, scopes, access_token, refresh_token, created_at) values ($1, $2, $3, $4, $5, $6, $7) returning *",
            [
                nanoid(16),
                req.user.id,
                req.body.client_id,
                scopes,
                randomBytes(32).toString("base64"),
                randomBytes(10).toString("base64"),
                Date.now(),
            ],
        );

        if (newAuth.length > 1) {
            return die("server_error")
        } else {
            return success(newAuth[0].id)
        }
    }
});

//#endregion
