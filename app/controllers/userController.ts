
/*
 * Logic for user endpoints.
 */

import { sign, verify } from "jsonwebtoken";
import connection = require('../config/dbConnection');
import { genSalt, hash, compare } from 'bcrypt';
import { retrieveFoodprint, updateAvatarInS3, emptyS3Directory } from './photoController';
import { Request, Response, NextFunction } from "express";

/// Logic for registering a user 
export const registerUser = async (req: Request, res: Response): Promise<void> => {

    const { username, password } = req.body;

    try {
        const existing_users: any = await connection.query("SELECT id FROM users WHERE username = $1", [username]);

        if (existing_users.rows.length > 0) {
            res.sendStatus(409);
        }
        else {
            // Hash Password
            const salt: any = await genSalt(10);
            const passwordHash: any = await hash(password, salt);

            await connection.query("INSERT INTO users (username, password) \
            VALUES ($1, $2)", [username, passwordHash]);

            res.sendStatus(200);
        }
    } catch (e) {
        console.error("ERROR REGISTERING USER TO DATABASE: ", e);
        res.sendStatus(401);
    }
};

/// Generate a JWT for user authorization 
const generateToken = (sub: any, username: any, avatar_url: any): string => {
    const payload = {
        sub,
        username,
        avatar_url,
    };

    // Sign the JWT
    return sign(payload, process.env.SIGNING_KEY!, { algorithm: 'HS256', expiresIn: "10 minutes" });
}

/// Logic for logging in
export const loginUser = async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body;

    try {
        const rows = (await connection.query("SELECT id, username, password, avatar_url FROM users WHERE username = $1", [username])).rows;
        if (!rows[0]) res.sendStatus(401);

        // User exists
        else {
            const hash = rows[0].password;
            const match = await compare(password, hash); // verify password
            if (!match) res.sendStatus(401);
            else {
                res.status(200).send(generateToken(rows[0].id, rows[0].username, rows[0].avatar_url));
            }
        }
    } catch (e) {
        console.error("ERROR LOGGING USER IN DATABASE: ", e);
        res.sendStatus(401);
    }
};

/// Retrieve the user's foodprint
export const getFoodprint = async (req: Request, res: Response): Promise<void> => {
    const { sub } = req.body.payload;
    const foodprint: any[] | null = await retrieveFoodprint(sub);

    // Could not retrieve foodprint
    if (!foodprint) res.sendStatus(400);
    else res.status(200).json({ foodprint: foodprint });
};

// Check if authorization header is defined
export const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
    const authorization: string | undefined = req.headers['authorization'];

    if (!authorization) {
        res.sendStatus(403);
    } else {
        try {
            const token = authorization.split(' ')[1];
            const payload = verify(token, process.env.SIGNING_KEY!);
            req.body.payload = payload;
            next();
        } catch (e) {
            console.error("AUTHORIZATION ERROR: ", e);
            res.sendStatus(403);
        }
    }
}

/*
 * The logic for updating the user's avatar. A successful response contains the updated JWT.
 */
export const changeAvatar = async (req: Request, res: Response): Promise<void> => {
    const { id, avatar_data, file_name } = req.body;

    try {
        // Check if avatar already exists
        const users = (await connection.query("SELECT username FROM users WHERE id = $1", [id])).rows;
        const username = users[0].username;

        // Upload to S3 
        const result: string | boolean = await updateAvatarInS3(id, avatar_data, file_name);
        if (typeof result !== "string") res.sendStatus(401);
        else {
            // Successful, save url to db
            await connection.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [result, id]);
            res.status(200).send(generateToken(id, username, result));
        }
    }
    catch (e) {
        console.error("ERROR UPDATING USER AVATAR: ", e);
        res.sendStatus(401);
    }
}

/*
 * Logic for updating the user's username.
 */
export const updateUsername = async (req: Request, res: Response): Promise<void> => {
    const { id, new_username } = req.body;

    try {
        // Check if username is already taken
        const rows = (await connection.query("SELECT id FROM users WHERE username = $1", [new_username])).rows;
        if (rows.length > 0) {
            res.sendStatus(402);
        }
        else {
            // Generate new JWT
            await connection.query("UPDATE users SET username = $1 WHERE id = $2", [new_username, id]);

            // Get user avatar
            const users = (await connection.query("SELECT avatar_url FROM users WHERE username = $1", [new_username])).rows;
            res.status(200).send(generateToken(id, new_username, users[0].avatar_url));
        }

    } catch (e) {
        console.error("ERROR UPDATING USERNAME: ", e);
        res.sendStatus(401);
    }
};

/// Logic for updating the user's password
export const updatePassword = async (req: Request, res: Response): Promise<void> => {
    const { id, old_password, new_password } = req.body;

    try {
        const rows = (await connection.query("SELECT password FROM users WHERE id = $1", [id])).rows;

        const prevHash = rows[0].password;
        const match = await compare(old_password, prevHash); // verify password

        // Correct password
        if (match) {
            // Hash Password
            const salt: any = await genSalt(10);
            const passwordHash: any = await hash(new_password, salt);
            await connection.query("UPDATE users SET password = $1 WHERE id = $2", [passwordHash, id]);
            res.sendStatus(200);
        }
        else {
            res.sendStatus(402);
        }
    } catch (e) {
        console.error("ERROR UPDATING PASSWORD: ", e);
        res.sendStatus(401);
    }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    const id: string | string[] | undefined = req.headers['id'];

    if (id) {
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
    }
    else {
        res.sendStatus(403); // no id provided
    }
};

