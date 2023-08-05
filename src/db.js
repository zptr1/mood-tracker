import config from "../config.json" assert { type: "json" };
import { readFile } from "fs/promises";
import pg from "pg";

export const pool = new pg.Pool(config.database);

/** @returns {Promise<any[]>} */
export async function exec$(query, values=[]) {
  return (await pool.query(query, values)).rows;
}

export async function fetch$(query, values=[]) {
  return (await exec$(query, values))[0];
}

export async function initDatabase() {
  await exec$(
    await readFile("data/setup.psql", "utf-8")
  );
}