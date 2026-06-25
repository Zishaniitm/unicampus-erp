import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * PostgreSQL connection pool.
 * Uses the DATABASE_URL from environment variables.
 * Pool is shared across the entire application.
 */
const pool = new Pool({
  connectionString: env.NODE_ENV === 'test' ? env.DATABASE_TEST_URL : env.DATABASE_URL,
  min: env.DATABASE_POOL_MIN,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error({ code: 'ERR-SYS-DB', message: 'Unexpected database pool error', error: err.message });
});

export const db = drizzle(pool);
export { pool };

/**
 * Gracefully closes the DB pool on process shutdown.
 * Called from app.ts on SIGTERM / SIGINT.
 */
export async function closeDb(): Promise<void> {
  await pool.end();
  logger.info('Database pool closed.');
}
