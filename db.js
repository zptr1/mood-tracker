import config from "./config.json" assert { type: "json" };
import pg from "pg";

export const pool = new pg.Pool(config.database);

/** @returns {Promise<any[]>} */
export async function exec$(query, values=[]) {
  return (await pool.query(query, values)).rows;
}

export async function fetch$(query, values=[]) {
  return (await exec$(query, values))[0];
}

exec$(`
  create table if not exists mood (
    id serial primary key,
    timestamp bigint,
    pleasantness float,
    energy float,
    user_id int
  );

  create table if not exists users (
    id serial primary key,
    username varchar(32) unique,
    password_hash varchar(60), -- bcrypt
    token varchar(64),
    created_at bigint,
    
    stats_mood_sets int default 0,

    custom_labels varchar(26)[] default array[]::varchar[],
    custom_colors int[] default array[]::int[],

    is_profile_private bool default false,
    is_stats_private bool default false
  );

  create index if not exists mood_user_id_idx on mood(user_id);
  create index if not exists users_username_idx on users(username);
  create index if not exists users_token_idx on users(token);
`);