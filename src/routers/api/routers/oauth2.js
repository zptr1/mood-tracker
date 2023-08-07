import express from "express";
import { appAuth } from "../util.js";
import { validateBody } from "../util.js";
import { z } from "zod";
import {fetch$} from "../../../db.js";

export const router = express.Router();

router.post(
    "/token",
    appAuth,
    validateBody(
        z.object({
            grant_type: z.string(),
            code: z.string(),
            redirect_uri: z.string().url()
        }),
        { error: "invalid_request" }
    ),
    async (req, res) => {
        const { code, redirect_uri, grant_type } = req.body;

        if (grant_type !== "authorization_code") {
            return res.status(400).send({
                error: "unsupported_grant_type"
            });
        }

        const auth = await fetch$(
            "select * from authorized_apps where id=$1 and app_id=$2",
            [code, req.app.id]
        );

        if (!auth || auth.redirect_uri !== redirect_uri) {
            return res.status(400).send({
                error: "invalid_grant"
            });
        }

        // ensure clients do not cache this request
        res.header("Cache-Control", "no-store");

        return res.send({
            access_token: auth.access_token,
            token_type: "Bearer",
            scope: auth.scope.join(' '),
        })
    }
);
