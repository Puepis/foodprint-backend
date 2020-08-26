
import { Pool } from "pg";

// Connect to postgres db
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export = pool;
