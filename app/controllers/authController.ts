import { genSalt, hash, compare } from "bcrypt";
import { createAccessToken, createRefreshToken } from "../auth/auth";
import { Request, Response } from "express";
import connection = require("../config/dbConnection");
import { verify } from "jsonwebtoken";

// Register
export const registerUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { username, password } = req.body;

  try {
    const existing_users: any = await connection.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );

    if (existing_users.rows.length > 0) {
      res.sendStatus(409);
    } else {
      const salt: any = await genSalt(10);
      const passwordHash: any = await hash(password, salt);

      await connection.query(
        "INSERT INTO users (username, password, refresh_token_version) \
            VALUES ($1, $2, $3)",
        [username, passwordHash, 0]
      );

      res.sendStatus(200);
    }
  } catch (e) {
    console.error("ERROR REGISTERING USER TO DATABASE: ", e);
    res.sendStatus(401);
  }
};

// Login
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  try {
    const rows = (
      await connection.query(
        "SELECT id, username, password, avatar_url, refresh_token_version FROM \
        users WHERE username = $1",
        [username]
      )
    ).rows;
    if (!rows[0]) res.sendStatus(401);
    else {
      const hash = rows[0].password;
      const match = await compare(password, hash); // verify password
      if (!match) res.sendStatus(401);
      else {
        // Login successful
        const accessToken = createAccessToken(
          rows[0].id,
          rows[0].username,
          rows[0].avatar_url
        );
        const refreshToken = createRefreshToken(
          rows[0].id,
          rows[0].refresh_token_version
        );
        res.status(200).json({ accessToken, refreshToken });
      }
    }
  } catch (e) {
    console.error("ERROR LOGGING USER IN DATABASE: ", e);
    res.sendStatus(401);
  }
};

export const refreshToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { refreshToken } = req.body;
  

  if (!refreshToken) {
    res.sendStatus(403);
    return;
  }

  let payload: any = null;
  try {
    payload = verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!);
  } catch (e) {
    console.error("INVALID REFRESH TOKEN", e);
    res.sendStatus(403);
    return;
  }

  // Check refresh token version
  const { sub, token_version } = payload;
  
  try {
    const rows = (
      await connection.query(
        "SELECT username, avatar_url, refresh_token_version FROM users \
        WHERE id = $1",
        [sub]
      )
    ).rows;
    if (!rows[0]) {
      res.sendStatus(403); // no user found
      return;
    }
    const user = rows[0];
    if (user.refresh_token_version !== token_version) {
      res.sendStatus(403);
      return;
    }

    // Refresh token is valid
    const accessToken = createAccessToken(
      rows[0].id,
      rows[0].username,
      rows[0].avatar_url
    );
    const refreshToken = createRefreshToken(
      rows[0].id,
      user.refresh_token_version
    );

    res.status(200).json({ accessToken, refreshToken });
  } catch (e) {
    console.error("ERROR LOGGING USER IN DATABASE: ", e);
    res.sendStatus(401);
  }
};

export const revokeRefreshTokens = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.body;
  try {
    await connection.query(
      "UPDATE users SET refresh_token_version = refresh_token_version + 1 \
      WHERE id = $1",
      [id]
    );
    res.sendStatus(200);
  } catch (e) {
    console.error("ERROR REVOKING TOKEN: ", e);
    res.sendStatus(401);
  }
};
