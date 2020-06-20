
/*
 * Here we define the logic for our user controller
 */

const jwt = require('jsonwebtoken');
const jwtDecode = require('jwt-decode');
const connection = require('../config/dbConnection');
const bcrypt = require('bcrypt');
const photoController = require('./photoController');

// Async/await
const util = require('util');
const query = util.promisify(connection.query).bind(connection);

require('dotenv').config();

// User object
const User = require('../models/userModel');

exports.registerUser = async (req, res) => {

    const { email, username, password} = req.body;

    try {
        // TODO: handle case where username is the same
        const existing_users = await query("SELECT id FROM users WHERE email = $1", [email]);

        if (existing_users.rows.length > 0) {
            res.sendStatus(409);
        }
        else {
             // Hash Password
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);

            await query("INSERT INTO users (email, username, password) \
            VALUES ($1, $2, $3)", [email, username, hash]);

            res.sendStatus(200);
        }
    } catch (e) {
        console.log(e);
        res.status(401).json(e);
    }
};



exports.loginUser = async (req, res) => {
    const {username, password} = req.body;

    try {
        const rows = (await query("SELECT id, username, password FROM users WHERE username = $1", [username])).rows;

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

                // Construct JWT
                const token = jwt.sign(payload, process.env.SIGNING_KEY, {algorithm: 'HS256', expiresIn: "10 minutes"});

                // Store time created into user table
                const timeCreated = jwtDecode(token).iat;
                await query("UPDATE users SET last_login = $1 WHERE username = $2", [timeCreated, payload.username]);
                res.status(200).send(token);
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

exports.getPhotos = async (req, res) => {

    const token = req.token;
    const decoded = jwtDecode(token);
    const id = decoded.sub;

    // Token verified
    const photos = await photoController.retrievePhotos(id);
    if (photos == null) {
        res.status(400).send("ERROR: Could not retrieve photos");
    } else {
        res.status(200).json({photos: photos}); // Successful authorization
    }
};

exports.getFoodprint = async (req, res) => {
    const token = req.token;
    const decoded = jwtDecode(token);
    const id = decoded.sub;
    
    const foodprint = await photoController.retrieveFoodprint(id);
    if (foodprint == null) {
        res.status(400).send("ERROR: Could not retrieve foodprint");
    } else {
        res.status(200).json({foodprint: foodprint});
    }
};

// Check if authorization header is defined
exports.verifyToken = (req, res, next) => {
    const header = req.headers['authorization'];
    if (typeof header !== 'undefined') {
        const bearer = header.split(' ');
        const token = bearer[1];

        jwt.verify(token, process.env.SIGNING_KEY, {algorithm: 'HS256'}, async (err, payload) => {
            if (err) {
                res.status(403).send("ERROR: Unauthorized token");

            } else { // check for deprecated token 

                const result = await query("SELECT last_login FROM users WHERE username = $1", [payload.username]);
                const last_login = result.rows[0].last_login;
                const timeIssued = payload.iat;

                // Invalid token 
                if (timeIssued < last_login) {
                    res.status(403).send("ERROR: Bad token");
                } else {
                    req.token = token;
                    next(); // authorized
                }
            }
        });
    } else {
        res.sendStatus(403); // header undefined
    }
}

    
/*
 * This function handles the logout logic for the application.
 */
exports.logout = async (req, res) => {

    try {
        // Update user's token creation time
        const username = req.body.username;

        // Get current time (seconds since epoch)
        const now = Math.round(Date.now() / 1000);
        await query('UPDATE users SET last_login = $1 WHERE username = $2', [now, username]);
        res.sendStatus(200);
    } catch (e) {
        console.log(e);
        res.status(401).send(e);
    }
}
