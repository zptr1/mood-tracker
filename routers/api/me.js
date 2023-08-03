import { DEFAULT_COLORS, DEFAULT_MOODS } from "../../util.js";
import { exec$, fetch$ } from "../../db.js";
import { randomBytes } from "crypto";
import { getAuth } from "../api.js";
import express from "express";
import bcrypt from "bcrypt";

export const router = express.Router();

router.get("/", getAuth, (req, res) => {
  res.json({
    username: req.user.username,
    created_at: req.user.created_at,
    total_mood_changes: req.user.stats_mood_sets,
    settings: {
      custom_labels: req.user.custom_labels,
      custom_colors: req.user.custom_colors,
      custom_font_size: req.user.custom_font_size,
      is_profile_private: req.user.is_profile_private,
      is_history_private: req.user.is_profile_private || req.user.is_history_private
    },
  })
});

router.patch("/", getAuth, async (req, res) => {
  if (req.body.username || req.body.new_password) {
    if (!await bcrypt.compare(req.body.confirm_password, req.user.password_hash)) {
      return res.status(401).json({
        status: "error",
        message: "Passwords do not match"
      });
    }
  }

  if (typeof req.body.username == "string") {
    if (!req.body.username.match(/^[a-z0-9_-]{3,32}$/)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid username"
      });
    }
    
    if (await fetch$("select 1 from users where username=$1", [req.body.username])) {
      return res.status(409).json({
        status: "error",
        message: "Username taken"
      });
    }

    req.user.username = req.body.username;
  }

  if (typeof req.body.new_password == "string") {
    req.user.password_hash = await bcrypt.hash(req.body.new_password, 10);
    req.user.token = randomBytes(48).toString("base64url");
  }

  if (typeof req.body.is_profile_private == "boolean")
    req.user.is_profile_private = req.body.is_profile_private;
  
  if (typeof req.body.is_history_private == "boolean")
    req.user.is_history_private = req.body.is_history_private;

  if (typeof req.body.custom_font_size == "string") {
    const size = {
      biggest: 1.4,
      big: 1.3,
      normal: 1.2,
      small: 1.1,
      smallest: 1.05
    }[req.body.custom_font_size];

    if (typeof size != "number") {
      return res.status(400).json({
        status: "error",
        message: "Expected `custom_font_size` to be one of ('biggest', 'big', 'normal', 'small', 'smallest')"
      });
    }

    req.user.custom_font_size = size;
  }

  if (req.body.custom_colors?.length == 0) {
    req.user.custom_colors = [];
  } else if (Array.isArray(req.body.custom_colors)) {
    if (
      req.body.custom_colors.length != DEFAULT_COLORS.length
      || req.body.custom_colors.find((x) => !Number.isInteger(x) || x < 0 || x > 0xFFFFFF)
    ) {
      return res.status(400).json({
        status: "error",
        message: `\`custom_colors\` must be an array of ${DEFAULT_COLORS.length} integers from 0 to ${0xFFFFFF}`
      });
    }

    req.user.custom_colors = req.body.custom_colors;
  }

  if (req.body.custom_labels?.length == 0) {
    req.user.custom_labels = [];
  } else if (Array.isArray(req.body.custom_labels)) {
    if (
      req.body.custom_labels.length != DEFAULT_MOODS.length
      || req.body.custom_labels.find((x) => typeof x != "string" || x.length < 1 || x.length > 64)
    ) {
      return res.status(400).json({
        status: "error",
        message: `\`custom_labels\` needs to be an array of ${DEFAULT_MOODS.length} strings, each from 1 to 64 characters in length`
      });
    }

    req.user.custom_labels = req.body.custom_labels.map(
      (x, i) => (
        x.replace(/[^\u0000-\u00FF]/g, "?")
         .replace(/[\s\n]+/g, " ")
         .replace(/[\/:]/g, "") // to prevent links
         .trim()
      ) || DEFAULT_MOODS[i]
    );
  }

  await exec$(`
    update users set
      username=$1,
      password_hash=$2,
      token=$3,
      is_profile_private=$4,
      is_history_private=$5,
      custom_colors=$6,
      custom_labels=$7,
      custom_font_size=$8
    where id=$9
  `, [
    req.user.username, req.user.password_hash, req.user.token,
    req.user.is_profile_private, req.user.is_history_private,
    req.user.custom_colors, req.user.custom_labels, req.user.custom_font_size,
    req.user.id
  ]);

  res.json({
    status: "ok"
  });
})

router.delete("/", getAuth, async (req, res) => {
  if (typeof req.body.password != "string")
    return res.status(400).json({
      status: "error",
      message: "Missing `password` body field"
    });

  if (!await bcrypt.compare(req.body.password, req.user.password_hash))
    return res.status(401).json({
      status: "error",
      message: "Passwords do not match"
    });

  await exec$("delete from mood where user_id=$1", [req.user.id]);
  await exec$("delete from users where id=$1", [req.user.id]);

  res.json({
    status: "ok"
  });
})