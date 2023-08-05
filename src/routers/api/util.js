import { fromZodError } from 'zod-validation-error';
import { fetch$ } from "../../db.js";
import z from "zod";

export async function getAuth(req, res, next) {
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

export async function userParamOrAuth(req, res, next) {
  if (req.headers.authorization) {
    req.auth = await fetch$(
      "select * from users where token=$1",
      [req.headers.authorization]
    );
  }

  if (req.params.user) {
    if (!req.params.user.match(/^[a-z0-9_-]{3,32}$/))
      return next();

    req.user = await fetch$(
      "select * from users where username=$1 and ((is_profile_private=false and is_history_private=false) or id=$2)",
      [req.params.user, req.auth?.id ?? -1]
    );
  } else req.user = req.auth;

  if (!req.user) {
    res.status(
      req.params.user ? 404 : 401
    ).json({
      status: "error",
      message: req.params.user
        ? "User not found"
        : "Unauthorized"
    });
  } else {
    next();
  }
}

export function validateBody(obj) {
  return async function (req, res, next) {
    try {
      await obj.parseAsync(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          status: "error",
          message: fromZodError(err, {
            prefix: "Invalid body"
          }).toString()
        });
      } else {
        throw err;
      }
    }
  }
}

export function validateQuery(obj) {
  return async function (req, res, next) {
    try {
      await obj.parseAsync(req.query);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          status: "error",
          message: fromZodError(err, {
            prefix: "Invalid query"
          }).toString()
        });
      } else {
        throw err;
      }
    }
  }
}
