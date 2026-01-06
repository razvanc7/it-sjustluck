import { Pool } from 'pg';

const RENDER_DATABASE_URL = "postgresql://razvan:048zpdAdghkttLg4P44iVbMwJga3omun@dpg-d5elb2ggjchc73bgdl50-a.frankfurt-postgres.render.com/db_ms4w"

const pool = new Pool({
  connectionString: RENDER_DATABASE_URL,
  ssl: {
      rejectUnauthorized: false
  }
});

export default pool;