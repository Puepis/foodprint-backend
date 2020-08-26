"use strict";
const pg_1 = require("pg");
// Connect to postgres db
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
module.exports = pool;
