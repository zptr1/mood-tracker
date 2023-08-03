import { getAuth, userParamOrAuth } from "../api.js";
import { exec$ } from "../../db.js";
import express from "express";
import bcrypt from "bcrypt";

export const router = express.Router();

router.get("/all/:user?", userParamOrAuth, async (req, res, next) => {
  const sort = (
    req.query.sort == "newest"
      ? "desc"
    : req.query.sort == "oldest"
      ? "asc"
    : null
  );

  if (req.query.sort && !sort) {
    return res.json({
      status: "error",
      message: "`sort` must be one of ('newest', 'oldest')"
    });
  }

  const history = await exec$(`
    select
      timestamp, pleasantness, energy
    from mood
      where user_id=$1
      order by id ${sort || "desc"}
  `, [req.user.id]);

  res.json({
    status: "ok",
    entries: history.map((x) => ({
      timestamp: x.timestamp,
      pleasantness: Math.floor(x.pleasantness * 100) / 100,
      energy: Math.floor(x.energy * 100) / 100
    }))
  });
});

router.delete("/all", getAuth, async (req, res) => {
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

  res.json({
    status: "ok"
  });
})

router.get("/:user?", userParamOrAuth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 25;
  const page = parseInt(req.query.page) || 0;
  const pages = Math.floor(req.user.stats_mood_sets / limit);
  const before = parseInt(req.query.before) || Date.now();
  const after = parseInt(req.query.after) || 0;
  const sort = (
    req.query.sort == "newest"
      ? "desc"
    : req.query.sort == "oldest"
      ? "asc"
    : null
  );

  if (limit < 1 || limit > 100) {
    return res.json({
      status: "error",
      messge: "`limit` must be in range 1..100"
    });
  }

  if (req.query.sort && !sort) {
    return res.json({
      status: "error",
      message: "`sort` must be one of ('newest', 'oldest')"
    });
  }

  if (after < 0 || after >= before || !Number.isSafeInteger(before) || !Number.isSafeInteger(after)) {
    return res.json({
      status: "error",
      message: "Invalid time range"
    });
  }

  if (page < 0 || (page && page >= pages)) {
    return res.json({
      status: "ok",
      entries: [],
      total: req.user.stats_mood_sets,
      pages: pages
    })
  }

  const history = await exec$(`
    select
      timestamp, pleasantness, energy
    from mood where
      user_id=$1
      and timestamp > $2
      and timestamp < $3
    order by id ${sort || "desc"} limit ${limit} offset ${page * limit}
  `, [req.user.id, after, before]);

  res.json({
    status: "ok",
    entries: history.map((x) => ({
      timestamp: x.timestamp,
      pleasantness: Math.floor(x.pleasantness * 100) / 100,
      energy: Math.floor(x.energy * 100) / 100
    })),
    total: req.user.stats_mood_sets,
    pages: pages
  });
});
