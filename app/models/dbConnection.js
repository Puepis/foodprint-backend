
require('dotenv').config();
const mysql = require('mysql');

const pool = mysql.createPool({
    user: process.env.GCLOUD_SQL_USERNAME_TESTING,
    database: process.env.GCLOUD_DB_NAME_TESTING,
    socketPath: `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME_TESTING}`
});

module.exports = pool;
