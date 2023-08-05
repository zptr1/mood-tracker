import { exec$ } from "./db.js";

async function cleanMoodHistory() {
  const users = await exec$("select id, history_threshold_days as days from users where history_threshold_days > 0");
  const now = Date.now();
  const day = 24 * 3600 * 1000;

  for (const { id, days } of users) {
    await exec$(
      "delete from mood where user_id=$1 and timestamp<$1",
      [id, now - day * days]
    );
  }
}

setInterval(cleanMoodHistory, 3600 * 1000); // every 1 hour
