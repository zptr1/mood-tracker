import express from "express";
import {getAuth} from "../auth.js";
import {DEFAULT_COLORS, DEFAULT_MOODS} from "../../const.js";
import {exec$, fetch$} from "../../db.js";
import {createId} from "../../util.js";
import crypto from "crypto";
import {settingsCategories} from "../app.js";

export const router = express.Router();

// todo: move these two to client-side script and an api route
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
        categories: settingsCategories
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

    /**
     * @type {URL}
     */
    let url

    try {
        url = new URL(req.body.redirect_uri);

        // TODO: uncomment this if we decide HTTPS is required
        // if (url.protocol !== 'https:') {
        //   return die("Redirect URI must be HTTPS.");
        // }
    } catch {
        return die("Invalid redirect URI.");
    }

    url.searchParams.delete('error');
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.hash = '';

    await exec$(
        "insert into apps values ($1, $2, $3, $4, $5, $6)", [
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
  const app_id = req.body.app_id;

  if (!app_id || typeof app_id !== "string") {
    return res.render("error/400", {
        error: "Invalid application ID",
    });
  }

  const app = await fetch$("select 1 from apps where id = $1 and owner_id = $2", [app_id, req.user.id]);

  if (!app) {
    return res.render("error/400", {
        error: "Invalid application ID",
    });
  }

  await exec$("delete from apps where id = $1 and owner_id = $2", [app_id, req.user.id]);
  await exec$("delete from authorized_apps where app_id = $1", [app_id]);

  return res.redirect("/settings/api");
})

router.get("/delete-app", getAuth(true), async (req, res) => {
    return res.redirect("/settings/api")
})
