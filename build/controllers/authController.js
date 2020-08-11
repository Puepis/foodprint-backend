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
exports.revokeRefreshTokens = exports.refreshToken = exports.loginUser = exports.registerUser = void 0;
const bcrypt_1 = require("bcrypt");
const auth_1 = require("../auth/auth");
const connection = require("../config/dbConnection");
const jsonwebtoken_1 = require("jsonwebtoken");
// Register
exports.registerUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    try {
        const existing_users = yield connection.query("SELECT id FROM users WHERE username = $1", [username]);
        if (existing_users.rows.length > 0) {
            res.sendStatus(409);
        }
        else {
            const salt = yield bcrypt_1.genSalt(10);
            const passwordHash = yield bcrypt_1.hash(password, salt);
            yield connection.query("INSERT INTO users (username, password, refresh_token_version) \
            VALUES ($1, $2, $3)", [username, passwordHash, 0]);
            res.sendStatus(200);
        }
    }
    catch (e) {
        console.error("ERROR REGISTERING USER TO DATABASE: ", e);
        res.sendStatus(401);
    }
});
// Login
exports.loginUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    try {
        const rows = (yield connection.query("SELECT id, username, password, avatar_url refresh_token_version FROM \
        users WHERE username = $1", [username])).rows;
        if (!rows[0])
            res.sendStatus(401);
        else {
            const hash = rows[0].password;
            const match = yield bcrypt_1.compare(password, hash); // verify password
            if (!match)
                res.sendStatus(401);
            else {
                // Login successful
                const accessToken = auth_1.createAccessToken(rows[0].id, rows[0].username, rows[0].avatar_url);
                const refreshToken = auth_1.createRefreshToken(rows[0].id, rows[0].refresh_token_version);
                res.status(200).json({ accessToken, refreshToken });
            }
        }
    }
    catch (e) {
        console.error("ERROR LOGGING USER IN DATABASE: ", e);
        res.sendStatus(401);
    }
});
exports.refreshToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        res.sendStatus(403);
        return;
    }
    let payload = null;
    try {
        payload = jsonwebtoken_1.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    }
    catch (e) {
        console.error("INVALID REFRESH TOKEN", e);
        res.sendStatus(403);
        return;
    }
    // Check refresh token version
    const { sub, token_version } = payload;
    try {
        const rows = (yield connection.query("SELECT username, avatar_url, refresh_token_version FROM users \
        WHERE id = $1", [sub])).rows;
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
        const accessToken = auth_1.createAccessToken(rows[0].id, rows[0].username, rows[0].avatar_url);
        const refreshToken = auth_1.createRefreshToken(rows[0].id, user.refresh_token_version);
        res.status(200).json({ accessToken, refreshToken });
    }
    catch (e) {
        console.error("ERROR LOGGING USER IN DATABASE: ", e);
        res.sendStatus(401);
    }
});
exports.revokeRefreshTokens = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.body;
    try {
        yield connection.query("UPDATE users SET refresh_token_version = refresh_token_version + 1 \
      WHERE id = $1", [id]);
        res.sendStatus(200);
    }
    catch (e) {
        console.error("ERROR REVOKING TOKEN: ", e);
        res.sendStatus(401);
    }
});
