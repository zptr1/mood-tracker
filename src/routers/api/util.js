import { fromZodError } from 'zod-validation-error';
import { fetch$ } from "../../db.js";
import { z } from 'zod';

export function auth(scope) {
  return async function (req, res, next) {
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      const auth = await fetch$(
        "select * from authorized_apps where access_token=$1",
        [req.headers.authorization.split(" ")[1]],
      );

      if (!auth) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized"
        });
      } else if (!auth.scopes.includes(scope)) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden"
        });
      }

      req.oauth2 = auth;
      req.user = await fetch$(
        "select * from users where id=$1",
        [auth.user_id]
      );
    } else if (req.headers.authorization) {
      req.user = await fetch$("select * from users where token=$1", [
        req.headers.authorization
      ]);
    }

    if (req.params.user) {
      if (!req.params.user.match(/^[a-z0-9_-]{3,32}$/))
        return next();
      
      req.user = await fetch$(
        "select * from users where username=$1 and ((is_profile_private=false and is_history_private=false) or id=$2)",
        [req.params.user, req.user?.id ?? -1]
      );
    }

    if (!req.user) {
      return res.status(
        req.params.user ? 404 : 401
      ).json({
        status: "error",
        message: req.params.user
          ? "User not found"
          : "Unauthorized"
      });
    }

    next();
  }
}

export async function appAuth(req, res, next) {
  if (!req.body.client_id || !req.body.client_secret) {
    return res.status(400).send({
      error: "invalid_client"
    });
  }

  req.app = await fetch$(
    "select * from apps where id=$1 and secret=$2",
    [req.body.client_id, req.body.client_secret]
  );

  if (!req.app) {
    res.status(401).send({
      error: "invalid_client"
    });
  } else {
    next();
  }
}

export function validateBody(shape, error=null) {
  const obj = z.object(shape);

  return async function (req, res, next) {
    const body = await obj.safeParseAsync(req.body);

    if (body.success) {
      next();
    } else if (error) {
      res.status(400).json(error);
    } else {
      res.status(400).json({
        status: "error",
        message: fromZodError(body.error, {
          prefix: "Invalid body"
        }).toString()
      })
    }
  }
}

export function validateQuery(shape, error=null) {
  const obj = z.object(shape);
  
  return async function (req, res, next) {
    const query = await obj.safeParseAsync(req.query);

    if (query.success) {
      next();
    } else if (error) {
      res.status(400).json(error);
    } else {
      res.status(400).json({
        status: "error",
        message: fromZodError(query.error, {
          prefix: "Invalid query"
        }).toString()
      })
    }
  }
}
