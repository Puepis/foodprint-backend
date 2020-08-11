"use strict";
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
exports.deleteUser = exports.updatePassword = exports.updateUsername = exports.changeAvatar = exports.getFoodprint = void 0;
const connection = require("../config/dbConnection");
const bcrypt_1 = require("bcrypt");
const auth_1 = require("../auth/auth");
const photoController_1 = require("./photoController");
const storage_1 = require("../image_storage/storage");
// Retrieve the user's foodprint
exports.getFoodprint = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { sub } = req.body.payload;
    const foodprint = yield photoController_1.retrieveFoodprint(sub);
    // Could not retrieve foodprint
    if (!foodprint)
        res.sendStatus(400);
    else
        res.status(200).json({ foodprint });
});
/*
 * The logic for updating the user's avatar. A successful response contains the updated JWT.
 */
exports.changeAvatar = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { avatar_data, file_name, payload } = req.body;
    const id = payload.sub;
    try {
        // Check if avatar already exists
        const users = (yield connection.query("SELECT username FROM users WHERE id = $1", [id])).rows;
        const username = users[0].username;
        // Upload to S3
        const result = yield storage_1.updateAvatarInS3(id, avatar_data, file_name);
        if (typeof result !== "string")
            res.sendStatus(401);
        else {
            // Successful, save url to db
            yield connection.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [
                result,
                id,
            ]);
            res.status(200).send(auth_1.createAccessToken(id, username, result));
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
    const { new_username, payload } = req.body;
    const id = payload.sub;
    try {
        // Check if username is already taken
        const rows = (yield connection.query("SELECT id FROM users WHERE username = $1", [
            new_username,
        ])).rows;
        if (rows.length > 0) {
            res.sendStatus(402);
        }
        else {
            // Generate new JWT
            yield connection.query("UPDATE users SET username = $1 WHERE id = $2", [
                new_username,
                id,
            ]);
            // Get user avatar
            const users = (yield connection.query("SELECT avatar_url FROM users WHERE username = $1", [new_username])).rows;
            res
                .status(200)
                .send(auth_1.createAccessToken(id, new_username, users[0].avatar_url));
        }
    }
    catch (e) {
        console.error("ERROR UPDATING USERNAME: ", e);
        res.sendStatus(401);
    }
});
/// Logic for updating the user's password
exports.updatePassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { old_password, new_password, payload } = req.body;
    const id = payload.sub;
    try {
        const rows = (yield connection.query("SELECT password FROM users WHERE id = $1", [id])).rows;
        const prevHash = rows[0].password;
        const match = yield bcrypt_1.compare(old_password, prevHash); // verify password
        // Correct password
        if (match) {
            // Hash Password
            const salt = yield bcrypt_1.genSalt(10);
            const passwordHash = yield bcrypt_1.hash(new_password, salt);
            yield connection.query("UPDATE users SET password = $1 WHERE id = $2", [
                passwordHash,
                id,
            ]);
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
    const { payload } = req.body;
    const id = payload.sub;
    try {
        // Remove all of the user's photos
        yield storage_1.emptyS3Directory(`${id}/`);
        yield connection.query("DELETE FROM photos WHERE user_id = $1", [id]);
        // Delete user from db
        yield connection.query("DELETE FROM users WHERE id = $1", [id]);
        res.sendStatus(200);
    }
    catch (e) {
        console.error("ERROR DELETING USER: ", e);
        res.sendStatus(401);
    }
});
