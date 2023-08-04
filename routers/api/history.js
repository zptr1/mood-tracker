import { getAuth, userParamOrAuth, validateBody, validateQuery } from "../api.js";
import { exec$ } from "../../db.js";
import express from "express";
import bcrypt from "bcrypt";
import { z } from "zod";

export const router = express.Router();

router.get("/all/:user?", userParamOrAuth, validateQuery(z.object({
  sort: z.enum(["newest", "oldest"]).optional()
})), async (req, res, next) => {
  const sort = (
    req.query.sort == "newest"
      ? "desc"
    : req.query.sort == "oldest"
      ? "asc"
    : "desc"
  );

  const history = await exec$(`
    select
      timestamp, pleasantness, energy
    from mood where user_id=$1
    order by id ${sort}
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

router.delete("/all", getAuth, validateBody(z.object({
  password: z.string()
})), async (req, res) => {
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

router.get("/:user?", userParamOrAuth, validateQuery(z.object({
  limit: z.coerce.number().int().min(0).max(100).optional(),
  page: z.coerce.number().int().optional(),
  before: z.coerce.number().int().positive().optional(),
  after: z.coerce.number().int().positive().optional(),
  sort: z.enum(["newest", "oldest"]).optional()
})), async (req, res) => {
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
    : "desc"
  );

  if (page < 0 || (page && page >= pages) || after >= before) {
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
      user_id=$1 and timestamp > $2 and timestamp < $3
    order by id ${sort} limit ${limit} offset ${page * limit}
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
