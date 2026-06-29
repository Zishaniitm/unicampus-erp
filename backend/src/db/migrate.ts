import fs from 'fs';
import path from 'path';
import { pool } from './index';
import { logger } from '../utils/logger';

/**
 * Migration runner.
 * Runs all numbered SQL files in database/migrations/ in order.
 * Tracks applied migrations in a `_migrations` table so files aren't re-run.
 *
 * Run with: npm run db:migrate
 */
async function migrate() {
  const client = await pool.connect();

  try {
    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Find all SQL files in the migrations directory
    const migrationsDir = path.resolve(__dirname, '../../../database/migrations');
    if (!fs.existsSync(migrationsDir)) {
      logger.warn('No migrations directory found at ' + migrationsDir);
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Relies on numeric prefix: 010_, 011_, etc.

    const { rows: applied } = await client.query('SELECT filename FROM _migrations');
    const appliedSet = new Set(applied.map((r: any) => r.filename));

    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        logger.debug(`Skipping already-applied migration: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        logger.info(`✓ Applied migration: ${file}`);
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error(`✗ Failed migration: ${file}`, { error: (err as Error).message });
        throw err;
      }
    }

    if (count === 0) {
      logger.info('Database is up to date. No new migrations.');
    } else {
      logger.info(`Migration complete. Applied ${count} migration(s).`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  logger.error('Migration failed:', err);
  process.exit(1);
});
