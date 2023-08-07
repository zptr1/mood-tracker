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


export function scope(scope) {
  return async function (req, res, next) {
    if (req.user) {
      next();
      return;
    }

    if (!req.header["authorization"]) {
        res.status(401).json({
            status: "error",
            message: "Unauthorized"
        })
        return;
    }

    const [prefix, token] = req.header("Authorization")?.split(" ") || [];

    if (prefix !== "Bearer") {
      req.user = await fetch$("select * from users where token=$1", [
        req.headers.authorization
      ]);

      if (req.user) {
        next();
        return;
      } else {
        res.status(401).json({
          status: "error",
          message: "Unauthorized"
        })
        return;
      }
    }

    const auth = await fetch$(
        "select * from authorized_apps where access_token=$1",
        [req.header("Authorization")?.split(" ")[1]],
    );

    if (!auth || !auth.scope.includes(scope)) {
        res.status(403).json({
            status: "error",
            message: "Forbidden"
        })
        return;
    }

    req.user = await fetch$("select * from users where id=$1", [auth.user_id]);

    if (!req.user) {
        res.status(401).json({
            status: "error",
            message: "Unauthorized"
        })
        return;
    }

    req.oauth2 = auth;

    next();
  }
}

export async function appAuth(req, res, next) {
  // https://datatracker.ietf.org/doc/html/rfc6749#section-2.3.1

  const {client_id, client_secret} = req.body;

  if (!client_id || !client_secret) {
    return res.status(400).send({
      error: "invalid_client"
    });
  }

  req.app = await fetch$("select * from apps where id=$1 and secret=$2", [
    client_id, client_secret
  ]);

  if (!req.app) {
    return res.status(401).send({
      error: "invalid_client"
    });
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

export function validateBody(obj, defaultError) {
  return async function (req, res, next) {
    try {
      await obj.parseAsync(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        if (!defaultError) return res.status(400).json({
          status: "error",
          message: fromZodError(err, {
            prefix: "Invalid body"
          }).toString()
        });
        else return res.status(400).json(defaultError);
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
