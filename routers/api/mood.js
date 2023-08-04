import { getAuth, userParamOrAuth, validateBody } from "../api.js";
import { fetchMood } from "../../util.js";
import { exec$, fetch$ } from "../../db.js";
import express from "express";
import { z } from "zod";

export const router = express.Router();

router.get("/:user?", userParamOrAuth, async (req, res, next) => {
  res.json({
    status: "ok",
    mood: await fetchMood(req.user)
  })
});

router.put("/", getAuth, validateBody(z.object({
  pleasantness: z.number().min(-1).max(1),
  energy: z.number().min(-1).max(1)
})), async (req, res) => {
  const lastMood = await fetch$(
    "select * from mood where user_id=$1 order by id desc limit 1",
    [req.user.id]
  );

  if (lastMood && (
    req.user.history_threshold_days == 0
    || parseInt(lastMood.timestamp) + 25000 > Date.now()
  )) {
    await exec$("update mood set pleasantness=$1, energy=$2, timestamp=$3 where id=$4", [
      req.body.pleasantness, req.body.energy, Date.now(), lastMood.id
    ]);
  } else {
    await exec$("insert into mood values (default, $1, $2, $3, $4)", [
      Date.now(), req.body.pleasantness, req.body.energy, req.user.id
    ]);

    await exec$(
      "update users set stats_mood_sets=stats_mood_sets + 1 where id=$1",
      [req.user.id]
    );
  }

  res.status(200).json({
    status: "ok"
  })
});

router.delete("/", getAuth, validateBody(z.object({
  timestamps: z.array(z.number().int().positive())
})), async (req, res) => {
  if (!Array.isArray(req.body.timestamps) || req.body.timestamps.find((x) => !Number.isInteger(x))) {
    return res.status(400).json({
      status: "error",
      message: "`timestamps` needs to be an array of integers"
    });
  }

  const deleted = await exec$(
    "delete from mood where user_id=$1 and timestamp=any($2) returning *",
    [req.user.id, req.body.timestamps]
  );

  res.json({
    status: "ok",
    deleted: deleted.length
  })
})