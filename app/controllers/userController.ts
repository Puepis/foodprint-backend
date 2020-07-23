
/*
 * Here we define the logic for our user controller
 */

import jwt from "jsonwebtoken";
import jwtDecode from 'jwt-decode';
import connection = require('../config/dbConnection');
import bcrypt from 'bcrypt';
import photoController = require('./photoController');

/// Env variables
import dotenv from "dotenv";
dotenv.config();

/// Logic for registering a user 
export async function registerUser(req: any, res: any): Promise<void> {

    const { username, password } = req.body;

    try {
        const existing_users: any = await connection.query("SELECT id FROM users WHERE username = $1", [username]);

        if (existing_users.rows.length > 0) {
            res.sendStatus(409);
        }
        else {
            // Hash Password
            const salt: any = await bcrypt.genSalt(10);
            const hash: any = await bcrypt.hash(password, salt);

            await connection.query("INSERT INTO users (username, password) \
            VALUES ($1, $2)", [username, hash]);

            res.sendStatus(200);
        }
    } catch (e) {
        console.log(e);
        res.status(401).json(e);
    }
};

/// Logic for logging in
export async function loginUser(req: any, res: any): Promise<void> {
    const { username, password } = req.body;

    try {
        const rows = (await connection.query("SELECT id, username, password FROM users WHERE username = $1", [username])).rows;

        // User exists
        if (rows[0]) {
            const hash = rows[0].password;
            const match = await bcrypt.compare(password, hash); // verify password
            if (match) {
                const payload = {
                    sub: rows[0].id, // subject
                    username: rows[0].username,
                    admin: false,
                };

                const key: String | undefined = process.env.SIGNING_KEY;
                if (typeof key === "string") {

                    // Construct JWT
                    const token: string = jwt.sign(payload, key, { algorithm: 'HS256', expiresIn: "10 minutes" });
                    res.status(200).send(token);
                }
                else {
                    console.log("No signing key config var found");
                    res.sendStatus(500);
                }

            }
            else {
                res.status(401).send("Invalid Password");
            }
        }
        else {
            res.status(401).send("Invalid username");
        }
    } catch (e) {
        console.log(e);
        res.status(401).send(e);
    }
};

/// Retrieve the user's foodprint
export async function getFoodprint(req: any, res: any): Promise<void> {
    const token: string = req.token;
    const decoded: any = jwtDecode(token);
    const id: number = decoded.sub;

    const foodprint: any[] | null = await photoController.retrieveFoodprint(id);

    // Could not retrieve foodprint
    if (foodprint == null) {
        res.sendStatus(400);
    } else {
        res.status(200).json({ foodprint: foodprint });
    }
};

// Check if authorization header is defined
export function verifyToken(req: any, res: any, next: any): void {

    const header: string | undefined = req.headers['authorization'];

    if (typeof header !== 'undefined') {

        const bearer: string[] = header.split(' ');
        const token: string = bearer[1];
        const key: string | undefined = process.env.SIGNING_KEY;

        if (typeof key !== 'undefined') {

            jwt.verify(token, key, async (err, payload: any) => {
                if (err) {
                    res.sendStatus(403); // unauthorized token

                }
                if (typeof payload !== "undefined") { // check for deprecated token 
                    req.token = token;
                    next();
                }
            });
        }
        else {
            res.sendStatus(500); // config var not found 
        }

    } else {
        res.sendStatus(403); // header undefined
    }
}

/// Logic for updating the user's username
export async function updateUsername(req: any, res: any): Promise<void> {
    const { id, new_username } = req.body;

    try {
        // Check if username is already taken
        const rows = (await connection.query("SELECT id FROM users WHERE username = $1", [new_username])).rows;
        if (rows.length > 0) {
            res.sendStatus(402);
        }
        else {
            await connection.query("UPDATE users SET username = $1 WHERE id = $2", [new_username, id]);
            res.sendStatus(200);
        }

    } catch (e) {
        console.log(e);
        res.status(401).send(e);
    }
};

/// Logic for updating the user's password
export async function updatePassword(req: any, res: any): Promise<void> {
    const { id, old_password, new_password } = req.body;

    try {
        const rows = (await connection.query("SELECT password FROM users WHERE id = $1", [id])).rows;

        const prevHash = rows[0].password;
        const match = await bcrypt.compare(old_password, prevHash); // verify password

        // Correct password
        if (match) {
            // Hash Password
            const salt: any = await bcrypt.genSalt(10);
            const hash: any = await bcrypt.hash(new_password, salt);
            await connection.query("UPDATE users SET password = $1 WHERE id = $2", [hash, id]);
            res.sendStatus(200);
        }
        else {
            res.sendStatus(402);
        }
    } catch (e) {
        console.log(e);
        res.status(401).send(e);
    }
};

export async function deleteUser(req: any, res: any): Promise<void> {
    const { id } = req.body;

    try {
        // Remove all of the user's photos
        await photoController.emptyS3Directory(id + '/');
        await connection.query("DELETE FROM photos WHERE user_id = $1", [id]);

        // Delete user from db 
        await connection.query("DELETE FROM users WHERE id = $1", [id]);

        res.sendStatus(200);

    } catch (e) {
        console.log(e);
        res.status(401).send(e);
    }
};

// TODO: Implement changeAvatar function