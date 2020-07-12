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
exports.logout = exports.verifyToken = exports.getFoodprint = exports.getPhotos = exports.loginUser = exports.registerUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwt_decode_1 = __importDefault(require("jwt-decode"));
const connection = require("../config/dbConnection");
const bcrypt_1 = __importDefault(require("bcrypt"));
const photoController = require("./photoController");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
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
                    const payload = {
                        sub: rows[0].id,
                        username: rows[0].username,
                        admin: false,
                    };
                    const key = process.env.SIGNING_KEY;
                    if (typeof key === "string") {
                        // Construct JWT
                        const token = jsonwebtoken_1.default.sign(payload, key, { algorithm: 'HS256', expiresIn: "10 minutes" });
                        // Store time created into user table
                        const decodedToken = jwt_decode_1.default(token);
                        if (decodedToken !== "undefined") {
                            const timeCreated = decodedToken.iat;
                            yield connection.query("UPDATE users SET last_login = $1 WHERE username = $2", [timeCreated, payload.username]);
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
        }
        catch (e) {
            console.log(e);
            res.status(401).send(e);
        }
    });
}
exports.loginUser = loginUser;
;
function getPhotos(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const token = req.token;
        const decoded = jwt_decode_1.default(token);
        const id = decoded.sub;
        // Token verified
        const photos = yield photoController.retrievePhotos(id);
        // Could not retrieve photos
        if (photos == null) {
            res.sendStatus(400);
        }
        else {
            res.status(200).json({ photos: photos });
        }
    });
}
exports.getPhotos = getPhotos;
;
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
                    const result = yield connection.query("SELECT last_login FROM users WHERE username = $1", [payload.username]);
                    const last_login = result.rows[0].last_login;
                    const timeIssued = payload.iat;
                    // Invalid token 
                    if (timeIssued < last_login) {
                        res.status(403).send("ERROR: Bad token");
                    }
                    else {
                        req.token = token;
                        next(); // authorized
                    }
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
/*
 * This function handles the logout logic for the application.
 */
function logout(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Update user's token creation time
            const username = req.body.username;
            // Get current time (seconds since epoch)
            const now = Math.round(Date.now() / 1000);
            yield connection.query('UPDATE users SET last_login = $1 WHERE username = $2', [now, username]);
            res.sendStatus(200);
        }
        catch (e) {
            console.log(e);
            res.status(401).send(e);
        }
    });
}
exports.logout = logout;
