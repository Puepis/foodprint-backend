"use strict";
/*
 * Here we define the logic for our user controller
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updatePassword = exports.updateUsername = exports.verifyToken = exports.getFoodprint = exports.loginUser = exports.registerUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwt_decode_1 = __importDefault(require("jwt-decode"));
const connection = require("../config/dbConnection");
const bcrypt_1 = __importDefault(require("bcrypt"));
const photoController = require("./photoController");
/// Env variables
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/// Logic for registering a user 
function registerUser(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { username, password } = req.body;
        try {
            const existing_users = yield connection.query("SELECT id FROM users WHERE username = $1", [username]);
            if (existing_users.rows.length > 0) {
                res.sendStatus(409);
            }
            else {
                // Hash Password
                const salt = yield bcrypt_1.default.genSalt(10);
                const hash = yield bcrypt_1.default.hash(password, salt);
                yield connection.query("INSERT INTO users (username, password) \
            VALUES ($1, $2)", [username, hash]);
                res.sendStatus(200);
            }
        }
        catch (e) {
            console.log(e);
            res.status(401).json(e);
        }
    });
}
exports.registerUser = registerUser;
;
function generateJWT(id, username) {
    const payload = {
        sub: id,
        username: username,
        admin: false,
    };
    const key = process.env.SIGNING_KEY;
    if (typeof key === "string") {
        // Sign the JWT
        const token = jsonwebtoken_1.default.sign(payload, key, { algorithm: 'HS256', expiresIn: "10 minutes" });
        return token;
    }
    return null;
}
/// Logic for logging in
function loginUser(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { username, password } = req.body;
        try {
            const rows = (yield connection.query("SELECT id, username, password FROM users WHERE username = $1", [username])).rows;
            // User exists
            if (rows[0]) {
                const hash = rows[0].password;
                const match = yield bcrypt_1.default.compare(password, hash); // verify password
                if (match) {
                    var token = generateJWT(rows[0].id, rows[0].username);
                    if (typeof token === "string") {
                        res.status(200).send(token);
                    }
                    else {
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
        }
        catch (e) {
            console.log(e);
            res.status(401).send(e);
        }
    });
}
exports.loginUser = loginUser;
;
/// Retrieve the user's foodprint
function getFoodprint(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const token = req.token;
        const decoded = jwt_decode_1.default(token);
        const id = decoded.sub;
        const foodprint = yield photoController.retrieveFoodprint(id);
        // Could not retrieve foodprint
        if (foodprint == null) {
            res.sendStatus(400);
        }
        else {
            res.status(200).json({ foodprint: foodprint });
        }
    });
}
exports.getFoodprint = getFoodprint;
;
// Check if authorization header is defined
function verifyToken(req, res, next) {
    const header = req.headers['authorization'];
    if (typeof header !== 'undefined') {
        const bearer = header.split(' ');
        const token = bearer[1];
        const key = process.env.SIGNING_KEY;
        if (typeof key !== 'undefined') {
            jsonwebtoken_1.default.verify(token, key, (err, payload) => __awaiter(this, void 0, void 0, function* () {
                if (err) {
                    res.sendStatus(403); // unauthorized token
                }
                if (typeof payload !== "undefined") { // check for deprecated token 
                    req.token = token;
                    next();
                }
            }));
        }
        else {
            res.sendStatus(500); // config var not found 
        }
    }
    else {
        res.sendStatus(403); // header undefined
    }
}
exports.verifyToken = verifyToken;
/// Logic for updating the user's username
function updateUsername(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
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
                var token = generateJWT(id, new_username);
                if (typeof token === "string") {
                    res.status(200).send(token);
                }
                else {
                    res.sendStatus(500);
                }
            }
        }
        catch (e) {
            console.log(e);
            res.status(401).send(e);
        }
    });
}
exports.updateUsername = updateUsername;
;
/// Logic for updating the user's password
function updatePassword(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id, old_password, new_password } = req.body;
        try {
            const rows = (yield connection.query("SELECT password FROM users WHERE id = $1", [id])).rows;
            const prevHash = rows[0].password;
            const match = yield bcrypt_1.default.compare(old_password, prevHash); // verify password
            // Correct password
            if (match) {
                // Hash Password
                const salt = yield bcrypt_1.default.genSalt(10);
                const hash = yield bcrypt_1.default.hash(new_password, salt);
                yield connection.query("UPDATE users SET password = $1 WHERE id = $2", [hash, id]);
                res.sendStatus(200);
            }
            else {
                res.sendStatus(402);
            }
        }
        catch (e) {
            console.log(e);
            res.status(401).send(e);
        }
    });
}
exports.updatePassword = updatePassword;
;
function deleteUser(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const id = req.headers['id'];
        try {
            // Remove all of the user's photos
            yield photoController.emptyS3Directory(id + '/');
            yield connection.query("DELETE FROM photos WHERE user_id = $1", [id]);
            // Delete user from db 
            yield connection.query("DELETE FROM users WHERE id = $1", [id]);
            res.sendStatus(200);
        }
        catch (e) {
            console.log(e);
            res.status(401).send(e);
        }
    });
}
exports.deleteUser = deleteUser;
;
// TODO: Implement changeAvatar function
