import { sign, verify } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export const createAccessToken = (
  sub: any,
  username: any,
  avatar_url: any
): string => {
  return sign({ sub, username, avatar_url }, process.env.ACCESS_TOKEN_SECRET!, {
    expiresIn: "15 minutes",
  });
};

export const createRefreshToken = (sub: any, token_version: any): string => {
  return sign({ sub, token_version }, process.env.REFRESH_TOKEN_SECRET!, {
    expiresIn: "7d",
  });
};

// Authorization middleware
export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authorization: string | undefined = req.headers["authorization"];
  console.log("Verifying token");

  if (!authorization) {
    res.sendStatus(403);
    return;
  }

  try {
    const token = authorization.split(" ")[1];
    const payload = verify(token, process.env.ACCESS_TOKEN_SECRET!);
    req.body.payload = payload;
    next();
  } catch (e) {
    console.error("AUTHORIZATION ERROR: ", e);
    res.sendStatus(403);
  }
};
