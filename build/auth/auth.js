"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.createRefreshToken = exports.createAccessToken = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
exports.createAccessToken = (sub, username, avatar_url) => {
    return jsonwebtoken_1.sign({ sub, username, avatar_url }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "15 minutes",
    });
};
exports.createRefreshToken = (sub, token_version) => {
    return jsonwebtoken_1.sign({ sub, token_version }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: "7d",
    });
};
// Authorization middleware
exports.verifyToken = (req, res, next) => {
    const authorization = req.headers["authorization"];
    console.log("Verifying token");
    if (!authorization) {
        res.sendStatus(403);
        return;
    }
    try {
        const token = authorization.split(" ")[1];
        const payload = jsonwebtoken_1.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.body.payload = payload;
        next();
    }
    catch (e) {
        console.error("AUTHORIZATION ERROR: ", e);
        res.sendStatus(403);
    }
};
