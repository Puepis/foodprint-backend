import connection = require("../config/dbConnection");
import { genSalt, hash, compare } from "bcrypt";
import { Request, Response } from "express";
import { createAccessToken } from "../auth/auth";
import { retrieveFoodprint } from "./photoController";
import { emptyS3Directory, updateAvatarInS3 } from "../image_storage/storage";

// Retrieve the user's foodprint
export const getFoodprint = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { sub } = req.body.payload;
  const foodprint: any[] | null = await retrieveFoodprint(sub);

  // Could not retrieve foodprint
  if (!foodprint) res.sendStatus(400);
  else res.status(200).json({ foodprint });
};

/*
 * The logic for updating the user's avatar. A successful response contains the updated JWT.
 */
export const changeAvatar = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { avatar_data, file_name, payload } = req.body;
  const id = payload.sub;

  try {
    // Check if avatar already exists
    const users = (
      await connection.query("SELECT username FROM users WHERE id = $1", [id])
    ).rows;
    const username = users[0].username;

    // Upload to S3
    const result: string | boolean = await updateAvatarInS3(
      id,
      avatar_data,
      file_name
    );
    if (typeof result !== "string") res.sendStatus(401);
    else {
      // Successful, save url to db
      await connection.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [
        result,
        id,
      ]);
      res.status(200).send(createAccessToken(id, username, result));
    }
  } catch (e) {
    console.error("ERROR UPDATING USER AVATAR: ", e);
    res.sendStatus(401);
  }
};

/*
 * Logic for updating the user's username.
 */
export const updateUsername = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { new_username, payload } = req.body;
  const id = payload.sub;

  try {
    // Check if username is already taken
    const rows = (
      await connection.query("SELECT id FROM users WHERE username = $1", [
        new_username,
      ])
    ).rows;
    if (rows.length > 0) {
      res.sendStatus(402);
    } else {
      // Generate new JWT
      await connection.query("UPDATE users SET username = $1 WHERE id = $2", [
        new_username,
        id,
      ]);

      // Get user avatar
      const users = (
        await connection.query(
          "SELECT avatar_url FROM users WHERE username = $1",
          [new_username]
        )
      ).rows;
      res
        .status(200)
        .send(createAccessToken(id, new_username, users[0].avatar_url));
    }
  } catch (e) {
    console.error("ERROR UPDATING USERNAME: ", e);
    res.sendStatus(401);
  }
};

/// Logic for updating the user's password
export const updatePassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { old_password, new_password, payload } = req.body;
  const id = payload.sub;

  try {
    const rows = (
      await connection.query("SELECT password FROM users WHERE id = $1", [id])
    ).rows;

    const prevHash = rows[0].password;
    const match = await compare(old_password, prevHash); // verify password

    // Correct password
    if (match) {
      // Hash Password
      const salt: any = await genSalt(10);
      const passwordHash: any = await hash(new_password, salt);
      await connection.query("UPDATE users SET password = $1 WHERE id = $2", [
        passwordHash,
        id,
      ]);
      res.sendStatus(200);
    } else {
      res.sendStatus(402);
    }
  } catch (e) {
    console.error("ERROR UPDATING PASSWORD: ", e);
    res.sendStatus(401);
  }
};

export const deleteUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { payload } = req.body;
  const id = payload.sub;

  try {
    // Remove all of the user's photos
    await emptyS3Directory(`${id}/`);
    await connection.query("DELETE FROM photos WHERE user_id = $1", [id]);

    // Delete user from db
    await connection.query("DELETE FROM users WHERE id = $1", [id]);

    res.sendStatus(200);
  } catch (e) {
    console.error("ERROR DELETING USER: ", e);
    res.sendStatus(401);
  }
};
