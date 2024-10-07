import config from "./config.json" assert { type: "json" };
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import express from "express";

import "express-async-errors";

import { initDatabase } from "./src/db.js";
import { initTasks } from "./src/tasks.js";
import { router } from "./src/index.js";

const app = express();

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ strict: true }));
app.use(cookieParser());
app.use("/", router);

process.on("uncaughtException", (e) => console.error(e));
process.on("unhandledRejection", (e) => console.error(e));

app.listen(config.port, async () => {
  await initDatabase();
  await initTasks();

  console.log(`Listening on :${config.port}`);
});