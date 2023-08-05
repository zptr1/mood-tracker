import { fetchMood } from "../../../util.js";
import { exec$ } from "../../../db.js";
import express from "express";

export const router = express.Router();

router.get("/", async (req, res) => {
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
      and is_history_private=false
    order by username desc
  `, [
    usernames
  ]);

  const moods = {};
  for (const user of users)
    moods[user.id] = await fetchMood(user);

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