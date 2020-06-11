
/*
 * Here we define the logic for our user controller
 */

const jwt = require('jsonwebtoken');
const jwtDecode = require('jwt-decode');
const connection = require('../config/dbConnection');
const bcrypt = require('bcrypt');

// Async/await
const util = require('util');
const query = util.promisify(connection.query).bind(connection);

require('dotenv').config();

// User object
const User = require('../models/userModel');

exports.registerUser = async (req, res) => {

    const { email, username, password} = req.body;

    let errors = [];

    // TODO: Input validation
    // Check required fields
    if (!email || !username || !password) {
        errors.push({msg: 'Please fill in all fields'});
    }

    if (errors.length > 0) {
        res.status(400).json({error: true, message: 'Errors found', errors: errors});
    }

    try {
        console.log("Registering user");
        // TODO: handle case where username is the same
        const existing_users = await query("SELECT id FROM users WHERE email = $1", [email]);

        if (existing_users.rows.length > 0) {
            errors.push({msg: 'Email is already registered!'});
            res.status(409).json(errors);
        }
        else {
             // Hash Password
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);

            await query("INSERT INTO users (email, username, password) \
            VALUES ($1, $2, $3)", [email, username, hash]);

            res.status(200).send("Success");
        }
    } catch (e) {
        console.log(e);
        res.status(401).json(e);
    }
};

async function getPhotos(id) {
    console.log("Getting photos");
    try {
        // Get list of photos
        var rows = (await query("SELECT * FROM photos WHERE user_id = $1", [id])).rows;
        rows.forEach(async photo => {
            photo.data = getPhotoDataFromS3(photo.path); // photo data
            var restaurant = (await query("SELECT * FROM restaurants WHERE id = $1", [photo.restaurant_id])).rows[0];
            photo.restaurant_name = restaurant.name;
            photo.restaurant_rating = restaurant.rating;
            photo.restaurant_lat = restaurant.lat;
            photo.restaurant_lng = restaurant.lng;
        });
        return rows; 
    } catch (e) {
        console.log(e);
        return null;
    }
}

exports.loginUser = async (req, res) => {
    const {username, password} = req.body;

    try {
        // Get user
        const rows = (await query("SELECT id, username, password FROM users WHERE username = $1", [username])).rows;

        // User exists
        if(rows[0]) {
            // Convert binary object to string
            const hash = rows[0].password;

            // Verify password
            const match = await bcrypt.compare(password, hash);

            // Correct password
            if (match) {
                const photos = await getPhotos(rows[0].id);
                const payload = { // should contain all info
                    message: photos == null ? "Error retrieving photos. Please log in again." : "Data retrieved",
                    photos: photos == null ? [] : photos,
                    user: {
                        id: rows[0].id,
                        username: rows[0].username,
                    }
                };

                // Construct JWT
                const token = jwt.sign(payload, process.env.SIGNING_KEY, {algorithm: 'HS256', expiresIn: "10 minutes"});

                // Store time created into user table
                const timeCreated = jwtDecode(token).iat;
                await query("UPDATE users SET last_login = $1 WHERE username = $2", [timeCreated, payload.username]);
                res.status(200).send(token);
            }
            else {
                console.log("Invalid password");
                res.status(401).send("Invalid Password");
            }
        }
        else {
            console.log("Invalid username");
            res.status(401).send("Invalid username");
        }
    } catch (e) {
        console.log(e);
        res.status(401).json(e);
    }
};

exports.getData = async (req, res) => {

    // Decode JWT
    const token = req.token;
    const decoded = jwtDecode(token);
    const username = decoded.username;
    const timeCreated = decoded.iat;


    jwt.verify(token, process.env.SIGNING_KEY, {algorithm: 'HS256'}, (err, authorizedData) => {
        if (err) {
            console.log(err);
            res.status(403).send("ERROR: Unauthorized token");
        } else { // check for deprecated token 
            const result = await query("SELECT last_login FROM users WHERE username = $1", [username]);
            const last_login = result.rows[0].last_login;

            // Invalid token (deprecated after logout)
            if (timeCreated < last_login) {
                res.status(403).send("ERROR: Bad token");
            } else {
                res.status(200).json({authorizedData}); // Successful authorization
            }
        }
    });
};

// Check if authorization header is defined
exports.checkToken = (req, res, next) => {
    const header = req.headers['Authorization'];
    if (typeof header !== 'undefined') {
        const bearer = header.split(' ');
        const token = bearer[1];
        req.token = token;
        next();
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
        res.status(200).send("Logged Out");
    } catch (e) {
        console.log(e);
        res.status(401).send("Can't log out");
    }
}
