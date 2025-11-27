import { Pool } from 'pg';

const RENDER_DATABASE_URL = "postgresql://razvan:bFCauKlToKXWbnRST3jZCt2a8EhZ4R9g@dpg-d4gvrbmmcj7s73bnd0qg-a.frankfurt-postgres.render.com/db_qw6h"

const pool = new Pool({
  connectionString: RENDER_DATABASE_URL,
  ssl: {
      rejectUnauthorized: false
  }
});

export default pool;