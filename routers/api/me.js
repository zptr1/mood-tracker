import { DEFAULT_COLORS, DEFAULT_MOODS } from "../../util.js";
import { getAuth, validateBody } from "../api.js";
import { exec$, fetch$ } from "../../db.js";
import { randomBytes } from "crypto";
import express from "express";
import bcrypt from "bcrypt";
import { z } from "zod";

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
      is_history_private: req.user.is_profile_private || req.user.is_history_private,
      history_threshold_days: req.user.history_threshold_days
    },
  })
});

router.patch("/", getAuth, validateBody(z.object({
  username: z.string()
    .regex(/^[a-z0-9_-]+$/, "Username contains invalid characters!")
    .min(3).max(32)
    .optional(),
  new_password: z.string().min(1).optional(),
  confirm_password: z.string().min(1).optional(),
  is_profile_private: z.boolean().optional(),
  is_history_private: z.boolean().optional(),
  custom_font_size: z.enum([
    "biggest", "big", "normal", "small", "smallest"
  ]).optional(),
  custom_colors: z.array(
    z.number().int().min(0).max(0xFFFFFF)
  ).length(DEFAULT_COLORS.length).optional(),
  custom_labels: z.array(
    z.string().min(1).max(53)
  ).length(DEFAULT_MOODS.length).optional(),
  history_threshold_days: z.number().int()
    .min(-1).max(365)
    .optional()
})), async (req, res) => {
  if (req.body.username || req.body.new_password) {
    if (!req.body.confirm_password) {
      return res.status(400).json({
        status: "error",
        message: "confirm_password field is required to change the username or the password"
      });
    }

    if (!await bcrypt.compare(req.body.confirm_password, req.user.password_hash)) {
      return res.status(401).json({
        status: "error",
        message: "Passwords do not match"
      });
    }
  }

  if (req.body.username) {
    if (await fetch$("select 1 from users where username=$1", [req.body.username])) {
      return res.status(409).json({
        status: "error",
        message: "Username taken"
      });
    }

    req.user.username = req.body.username;
  }

  if (req.body.new_password) {
    req.user.password_hash = await bcrypt.hash(req.body.new_password, 10);
    req.user.token = randomBytes(48).toString("base64url");
  }

  if (typeof req.body.is_profile_private == "boolean")
    req.user.is_profile_private = req.body.is_profile_private;
  
  if (typeof req.body.is_history_private == "boolean")
    req.user.is_history_private = req.body.is_history_private;

  if (typeof req.body.history_threshold_days == "number")
    req.user.history_threshold_days = req.body.history_threshold_days;

  if (req.body.custom_colors)
    req.user.custom_colors = req.body.custom_colors;

  if (req.body.custom_font_size) {
    req.user.custom_font_size = {
      biggest: 1.4,
      big: 1.3,
      normal: 1.2,
      small: 1.1,
      smallest: 1.05
    }[req.body.custom_font_size];
  }

  if (req.body.custom_labels) {
    req.user.custom_labels = req.body.custom_labels.map(
      (x, i) => (
        x.replace(/[^\u0000-\u00FF]/g, "?")
         .replace(/\n/g, "")
         .replace(/\s+/g, " ")
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
      history_threshold_days=$6,
      custom_colors=$7,
      custom_labels=$8,
      custom_font_size=$9
    where id=$10
  `, [
    req.user.username, req.user.password_hash, req.user.token,
    req.user.is_profile_private, req.user.is_history_private, req.user.history_threshold_days,
    req.user.custom_colors, req.user.custom_labels, req.user.custom_font_size,
    req.user.id
  ]);

  res.json({
    status: "ok"
  });
})

router.delete("/", getAuth, validateBody(z.object({
  password: z.string()
})), async (req, res) => {
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