import errorComments from "./data/error-comments.json" assert { type: "json" };
import config from "./config.json" assert { type: "json" };
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import express from "express";

const app = express();

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ strict: true }));
app.use(cookieParser());

import "./src/db.js";     // initialize database
import "./src/tasks.js";  // initialize tasks

import { router as authRouter } from "./src/routers/auth.js";
import { router as apiRouter } from "./src/routers/api/index.js";
import { router as appRouter } from "./src/routers/app.js";

app.use("/", appRouter);
app.use("/api", apiRouter);
app.use("/auth", authRouter);
app.use("/static", express.static("static"));

app.use((req, res, next) => res.status(404).render("error/404"));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("error/500", {
    comment: errorComments[Math.floor(Math.random() * errorComments.length)]
  });
});

app.listen(config.port, () => {
  console.log(`Listening on :${config.port}`);
});

process.on("uncaughtException", (e) => console.error(e));
process.on("unhandledRejection", (e) => console.error(e));