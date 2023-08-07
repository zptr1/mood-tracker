import { init as initCuid2 } from "@paralleldrive/cuid2";
import { DEFAULT_MOODS } from "./const.js";
import { fetch$ } from "./db.js";
import crypto from "crypto";

export const createId = initCuid2({
  random: () => crypto.randomInt(281474976710655) / 281474976710655,
  length: 16,
  fingerprint: 'mood-tracker',
});

export function moodInfo(pleasantness, energy, moods=DEFAULT_MOODS) {
  if (energy >= 0.67) {
    if (pleasantness >= 0.67) return moods[0];
    if (pleasantness >= 0.33) return moods[1];
    if (pleasantness >= 0) return moods[2];
    if (pleasantness >= -0.33) return moods[3];
    if (pleasantness >= -0.67) return moods[4];
    return moods[5];
  } else if (energy >= 0.33) {
    if (pleasantness >= 0.67) return moods[6];
    if (pleasantness >= 0.33) return moods[7];
    if (pleasantness >= 0) return moods[8];
    if (pleasantness >= -0.33) return moods[9];
    if (pleasantness >= -0.67) return moods[10];
    return moods[11];
  } else if (energy >= 0) {
    if (pleasantness >= 0.67) return moods[12];
    if (pleasantness >= 0.33) return moods[13];
    if (pleasantness >= 0) return moods[14];
    if (pleasantness >= -0.33) return moods[15];
    if (pleasantness >= -0.67) return moods[16];
    return moods[17];
  } else if (energy >= -0.33) {
    if (pleasantness >= 0.67) return moods[18];
    if (pleasantness >= 0.33) return moods[19];
    if (pleasantness >= 0) return moods[20];
    if (pleasantness >= -0.33) return moods[21];
    if (pleasantness >= -0.67) return moods[22];
    return moods[23];
  } else if (energy >= -0.67) {
    if (pleasantness >= 0.67) return moods[24];
    if (pleasantness >= 0.33) return moods[25];
    if (pleasantness >= 0) return moods[26];
    if (pleasantness >= -0.33) return moods[27];
    if (pleasantness >= -0.67) return moods[28];
    else return moods[29];
  } else {
    if (pleasantness >= 0.67) return moods[30];
    if (pleasantness >= 0.33) return moods[31];
    if (pleasantness >= 0) return moods[32];
    if (pleasantness >= -0.33) return moods[33];
    if (pleasantness >= -0.67) return moods[34];
    return moods[35];
  }
}

export function safeParseURL(url) {
  try {
    return new URL(url);
  } catch (e) {}
}

export async function fetchMood(user) {
  const mood = await fetch$(
    "select * from mood where user_id=$1 order by id desc limit 1",
    [user.id]
  );

  return mood ? {
    status: moodInfo(mood.pleasantness, mood.energy, user.custom_labels || DEFAULT_MOODS),
    pleasantness: mood.pleasantness,
    energy: mood.energy,
    timestamp: mood.timestamp
  } : {
    status: "-",
    pleasantness: 0,
    energy: 0,
    timestamp: null
  }
}