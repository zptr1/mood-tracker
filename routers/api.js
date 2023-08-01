import config from "../config.json" assert { type: "json" };
import { fetchMood, moodInfo } from "../util.js";
import { exec$, fetch$ } from "../db.js";
import express from "express";

export const router = express.Router();

async function getAuth(req, res, next) {
  if (req.headers.authorization) {
    req.user = await fetch$("select * from users where token=$1", [
      req.headers.authorization
    ]);
  }

  if (!req.user) {
    res.status(401).json({
      status: "error",
      message: "Unauthorized"
    })
  } else {
    next();
  }  
}

router.get("/me", getAuth, (req, res) => {
  res.json({
    username: req.user.username,
    created_at: req.user.created_at,
    total_mood_changes: req.user.stats_mood_sets,
    settings: {
      custom_mood_labels: req.user.custom_labels,
      custom_colors: req.user.custom_colors,
      is_profile_private: req.user.is_profile_private,
      is_stats_private: req.user.is_profile_private || req.user.is_stats_private
    },
  })
})

router.get("/mood", getAuth, async (req, res) => {
  res.json({
    status: "ok",
    mood: await fetchMood(req.user.id)
  });
});

router.get("/mood/:user", async (req, res, next) => {
  if (!req.params.user.match(/^[a-z0-9_-]{3,32}$/))
    return next();
  
  const user = await fetch$(
    "select * from users where username=$1",
    [req.params.user]
  );

  if (!user || user.is_profile_private) {
    return res.status(404).json({
      status: "error",
      message: "User not found"
    });
  }
  
  res.json({
    status: "ok",
    mood: await fetchMood(user.id)
  })
});

router.put("/mood", getAuth, async (req, res) => {
  if (
    typeof req.body.pleasantness != "number"
    || typeof req.body.energy != "number"
    || Math.abs(req.body.pleasantness) > 1
    || Math.abs(req.body.energy) > 1
  ) {
    return res.status(400).json({
      status: "error",
      message: "`pleasantness` and `energy` fields need to be a float from -1 to 1"
    });
  }

  const lastMood = await fetchMood(req.user.id);
  if (parseInt(lastMood.timestamp) + 10_000 > Date.now()) {
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

router.delete("/mood", getAuth, async (req, res) => {
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

router.get("/history/:user?", getAuth, async (req, res, next) => {
  const username = req.params.user || req.user.username;
  if (!username.match(/^[a-z0-9_-]{3,32}$/))
    return next();

  const user = await fetch$(
    "select * from users where username=$1",
    [username]
  );

  if (!user || ((user.is_profile_private || user.is_stats_private) && user.id != req.user.id)) {
    return res.status(404).json({
      status: "error",
      message: "User not found"
    });
  }

  const per = parseInt(req.query.per) || 25;
  const page = parseInt(req.query.page) || 0;
  const pages = Math.floor(user.stats_mood_sets / per);
  const before = parseInt(req.query.before) || Date.now();
  const after = parseInt(req.query.after) || 0;
  const sort = (
    req.query.sort == "newest"
      ? "desc"
    : req.query.sort == "oldest"
      ? "asc"
    : null
  );

  if ((per < 1 || per > 100) && per != -1) {
    return res.json({
      status: "error",
      messge: "`per` must be in range 1..100"
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
      total: user.stats_mood_sets,
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
    order by id ${sort || "desc"} limit ${per == -1 ? "all" : per} offset ${page * per}
  `, [user.id, after, before]);

  res.json({
    status: "ok",
    entries: history.map((x) => ({
      timestamp: x.timestamp,
      pleasantness: Math.floor(x.pleasantness * 100) / 100,
      energy: Math.floor(x.energy * 100) / 100
    })),
    total: user.stats_mood_sets,
    pages: pages
  });
});

router.get("/metrics", async (req, res) => {
  // TODO: show metrics for the API as well? (memory usage, uptime etc)

  if (!req.query.users) {
    return res.status(400).json({
      status: "error",
      message: "Missing query param `users`"
    });
  }

  const usernames = req.query.users.split(",");
  if (usernames.length > 16) {
    return res.status(400).json({
      status: "error",
      message: "Too many users"
    });
  }

  const users = await exec$(`
    select
      id, username, stats_mood_sets
    from users where
      username=any($1)
      and is_profile_private=false
      and is_stats_private=false
    order by username desc
  `, [
    usernames
  ]);

  const moods = {};
  for (const user of users)
    moods[user.id] = await fetchMood(user.id);

  res.setHeader("Content-Type", "text/plain");
  res.send([
    "# HELP user_energy Current energy of the user.",
    "# TYPE user_energy gauge",
    ...users.map((x) => `user_energy{user="${x.username}"} ${
      moods[x.id].energy.toFixed(2)
    }`),
    "",
    "# HELP user_pleasantness How pleasant the user is feeling.",
    "# TYPE user_pleasantness gauge",
    ...users.map((x) => `user_pleasantness{user="${x.username}"} ${
      moods[x.id].pleasantness.toFixed(2)
    }`),
    "",
    "# HELP user_mood_sets How often a user has changed their mood.",
    "# TYPE user_mood_sets counter",
    ...users.map((x) => `user_mood_sets{user="${x.username}"} ${
      x.stats_mood_sets
    }`),
  ].join("\n"));
})

router.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route not found"
  });
});
