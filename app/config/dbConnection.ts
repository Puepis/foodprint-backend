
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.HEROKU_POSTGRESQL_COBALT_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export = pool;
