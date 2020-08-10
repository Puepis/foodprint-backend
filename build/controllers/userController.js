"use strict";
/*
 * Logic for user endpoints.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updatePassword = exports.updateUsername = exports.changeAvatar = exports.verifyToken = exports.getFoodprint = exports.loginUser = exports.registerUser = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
const connection = require("../config/dbConnection");
const bcrypt_1 = require("bcrypt");
const photoController_1 = require("./photoController");
/// Logic for registering a user 
exports.registerUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    try {
        const existing_users = yield connection.query("SELECT id FROM users WHERE username = $1", [username]);
        if (existing_users.rows.length > 0) {
            res.sendStatus(409);
        }
        else {
            // Hash Password
            const salt = yield bcrypt_1.genSalt(10);
            const passwordHash = yield bcrypt_1.hash(password, salt);
            yield connection.query("INSERT INTO users (username, password) \
            VALUES ($1, $2)", [username, passwordHash]);
            res.sendStatus(200);
        }
    }
    catch (e) {
        console.error("ERROR REGISTERING USER TO DATABASE: ", e);
        res.sendStatus(401);
    }
});
/// Generate a JWT for user authorization 
const generateToken = (sub, username, avatar_url) => {
    const payload = {
        sub,
        username,
        avatar_url,
    };
    // Sign the JWT
    return jsonwebtoken_1.sign(payload, process.env.SIGNING_KEY, { algorithm: 'HS256', expiresIn: "10 minutes" });
};
/// Logic for logging in
exports.loginUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    try {
        const rows = (yield connection.query("SELECT id, username, password, avatar_url FROM users WHERE username = $1", [username])).rows;
        if (!rows[0])
            res.sendStatus(401);
        // User exists
        else {
            const hash = rows[0].password;
            const match = yield bcrypt_1.compare(password, hash); // verify password
            if (!match)
                res.sendStatus(401);
            else {
                res.status(200).send(generateToken(rows[0].id, rows[0].username, rows[0].avatar_url));
            }
        }
    }
    catch (e) {
        console.error("ERROR LOGGING USER IN DATABASE: ", e);
        res.sendStatus(401);
    }
});
/// Retrieve the user's foodprint
exports.getFoodprint = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { sub } = req.body.payload;
    const foodprint = yield photoController_1.retrieveFoodprint(sub);
    // Could not retrieve foodprint
    if (!foodprint)
        res.sendStatus(400);
    else
        res.status(200).json({ foodprint: foodprint });
});
// Check if authorization header is defined
exports.verifyToken = (req, res, next) => {
    const authorization = req.headers['authorization'];
    if (!authorization) {
        res.sendStatus(403);
    }
    else {
        try {
            const token = authorization.split(' ')[1];
            const payload = jsonwebtoken_1.verify(token, process.env.SIGNING_KEY);
            req.body.payload = payload;
            next();
        }
        catch (e) {
            console.error("AUTHORIZATION ERROR: ", e);
            res.sendStatus(403);
        }
    }
};
/*
 * The logic for updating the user's avatar. A successful response contains the updated JWT.
 */
exports.changeAvatar = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, avatar_data, file_name } = req.body;
    try {
        // Check if avatar already exists
        const users = (yield connection.query("SELECT username FROM users WHERE id = $1", [id])).rows;
        const username = users[0].username;
        // Upload to S3 
        const result = yield photoController_1.updateAvatarInS3(id, avatar_data, file_name);
        if (typeof result !== "string")
            res.sendStatus(401);
        else {
            // Successful, save url to db
            yield connection.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [result, id]);
            res.status(200).send(generateToken(id, username, result));
        }
    }
    catch (e) {
        console.error("ERROR UPDATING USER AVATAR: ", e);
        res.sendStatus(401);
    }
});
/*
 * Logic for updating the user's username.
 */
exports.updateUsername = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, new_username } = req.body;
    try {
        // Check if username is already taken
        const rows = (yield connection.query("SELECT id FROM users WHERE username = $1", [new_username])).rows;
        if (rows.length > 0) {
            res.sendStatus(402);
        }
        else {
            // Generate new JWT
            yield connection.query("UPDATE users SET username = $1 WHERE id = $2", [new_username, id]);
            // Get user avatar
            const users = (yield connection.query("SELECT avatar_url FROM users WHERE username = $1", [new_username])).rows;
            res.status(200).send(generateToken(id, new_username, users[0].avatar_url));
        }
    }
    catch (e) {
        console.error("ERROR UPDATING USERNAME: ", e);
        res.sendStatus(401);
    }
});
/// Logic for updating the user's password
exports.updatePassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, old_password, new_password } = req.body;
    try {
        const rows = (yield connection.query("SELECT password FROM users WHERE id = $1", [id])).rows;
        const prevHash = rows[0].password;
        const match = yield bcrypt_1.compare(old_password, prevHash); // verify password
        // Correct password
        if (match) {
            // Hash Password
            const salt = yield bcrypt_1.genSalt(10);
            const passwordHash = yield bcrypt_1.hash(new_password, salt);
            yield connection.query("UPDATE users SET password = $1 WHERE id = $2", [passwordHash, id]);
            res.sendStatus(200);
        }
        else {
            res.sendStatus(402);
        }
    }
    catch (e) {
        console.error("ERROR UPDATING PASSWORD: ", e);
        res.sendStatus(401);
    }
});
exports.deleteUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id = req.headers['id'];
    if (id) {
        try {
            // Remove all of the user's photos
            yield photoController_1.emptyS3Directory(`${id}/`);
            yield connection.query("DELETE FROM photos WHERE user_id = $1", [id]);
            // Delete user from db 
            yield connection.query("DELETE FROM users WHERE id = $1", [id]);
            res.sendStatus(200);
        }
        catch (e) {
            console.error("ERROR DELETING USER: ", e);
            res.sendStatus(401);
        }
    }
    else {
        res.sendStatus(403); // no id provided
    }
});
