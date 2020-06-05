
/*
 * Here we define the logic for our user controller
 */

const jwt = require('jsonwebtoken');
const jwtDecode = require('jwt-decode');
const connection = require('../models/dbConnection');
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
        const existing = await query("SELECT * FROM users WHERE email = $1", [email]);

        console.log(existing);

        if (existing.rows.length > 0) {
            errors.push({msg: 'Email is already registered!'});
            res.status(409).json(errors);
        }
        else {
             // Hash Password
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);

           const newUser = new User({email, username, hash});

            await query("INSERT INTO users (email, username, password) \
            VALUES ($1, $2, $3)", [newUser.email, newUser.username, newUser.password]);

            res.status(200).send("Success");
        }
    } catch (e) {
        console.log(e);
        res.status(401).json(e);
    }
};

exports.loginUser = async (req, res) => {
    const {username, password} = req.body;

    try {
        // Get user
        const rows = (await query("SELECT * FROM users WHERE username = $1", [username])).rows;

        // User exists
        if(rows[0]) {
            // Convert binary object to string
            const hash = rows[0].password;
            //const buff = new Buffer.from(rows[0].password, 'base60');
            //const text = buff.toString('ascii');

            // Verify password
            const match = await bcrypt.compare(password, hash);

            // Correct password
            if (match) {
                const payload = {
                    username: rows[0].username,
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

// Check if token is authorized
async function isAuthorized(token) {

    var authorized = false;

     // Decode JWT
    const decoded = jwtDecode(token);
    const timeCreated = decoded.iat;
    const username = decoded.username;

    try {
        jwt.verify(token, process.env.SIGNING_KEY, {algorithm: 'HS256'});

        const query_login = await query("SELECT last_login FROM users WHERE username = $1", [username]);

        // Last login
        const last_login = query_login.rows[0].last_login;

        // If token expired, return false
        authorized = !(timeCreated < last_login);

    } catch (e) {
        console.log(e);
    }
    return authorized;
}

exports.getID = async (req, res) => {

    // Decode JWT
    const token = req.get('Authorization');
    const decoded = jwtDecode(token);
    const username = decoded.username;

    const authorized = await isAuthorized(token);
    if (authorized) {
        try {
            // Send the id of the user back
            const id_res = await query("SELECT id FROM users WHERE username = $1", [username]);
            const id = id_res.rows[0].id;
            res.send(id.toString());
        } catch (e) {
            console.log(e);
            res.status(401).json(e);
        }
    }
    else {
        console.log(e);
        res.status(401).send("Unauthorized token");
    }
   
};

/*
 * This function handles the logout logic for the application.
 */
exports.logout = async (req, res) => {

    try {
        // Update user's token creation time
        const username = req.body.username;

        // Get current time (seconds since epoch)
        const now = Math.round(Date.now() / 1000);
        await query('UPDATE users SET last_login = ? WHERE username = ?', [now, username]);
        res.status(200).send("Logged Out");
    } catch (e) {
        res.status(401).send("Can't log out");
    }
}
