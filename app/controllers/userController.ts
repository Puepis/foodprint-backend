
/*
 * Here we define the logic for our user controller
 */

import jwt from "jsonwebtoken";
import jwtDecode from 'jwt-decode';
import connection = require('../config/dbConnection');
import bcrypt from 'bcrypt';
import photoController = require('./photoController');

import dotenv from "dotenv";
dotenv.config();

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

                    // Store time created into user table
                    const decodedToken: any = jwtDecode(token);
                    if (decodedToken !== "undefined") {
                        const timeCreated: number = decodedToken.iat;
                        await connection.query("UPDATE users SET last_login = $1 WHERE username = $2", [timeCreated, payload.username]);
                        res.status(200).send(token);
                    }
                    else {
                        console.log("Bad token");

                        res.sendStatus(500);
                    }
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

export async function getPhotos(req: any, res: any): Promise<void> {

    const token: string = req.token;
    const decoded: any = jwtDecode(token);
    const id: number = decoded.sub;

    // Token verified
    const photos: any[] | null = await photoController.retrievePhotos(id);

    // Could not retrieve photos
    if (photos == null) {
        res.sendStatus(400);
    } else {
        res.status(200).json({ photos: photos });
    }
};

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

                    const result: any = await connection.query("SELECT last_login FROM users WHERE username = $1", [payload.username]);
                    const last_login: number = result.rows[0].last_login;
                    const timeIssued: number = payload.iat;

                    // Invalid token 
                    if (timeIssued < last_login) {
                        res.status(403).send("ERROR: Bad token");
                    } else {
                        req.token = token;
                        next(); // authorized
                    }
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


/*
 * This function handles the logout logic for the application.
 */
export async function logout(req: any, res: any): Promise<void> {

    try {
        // Update user's token creation time
        const username: string = req.body.username;

        // Get current time (seconds since epoch)
        const now: number = Math.round(Date.now() / 1000);
        await connection.query('UPDATE users SET last_login = $1 WHERE username = $2', [now, username]);
        res.sendStatus(200);
    } catch (e) {
        console.log(e);
        res.status(401).send(e);
    }
}
