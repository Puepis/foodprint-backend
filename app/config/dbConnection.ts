
import { Pool } from "pg";

// Connect to postgres db
const pool = new Pool({
  connectionString: process.env.HEROKU_POSTGRESQL_COBALT_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export = pool;
