// Runs one SQL file against the database with psql, in a single transaction.
// Usage: pnpm migrate ../supabase/migrations/0002_something.sql
import { spawnSync } from 'node:child_process';

const file = process.argv[2];
const dbUrl = process.env.SUPABASE_DB_URL;
if (!file) throw new Error('Usage: pnpm migrate <path-to-sql-file>');
if (!dbUrl) throw new Error('Set SUPABASE_DB_URL in scripts/.env');

const result = spawnSync('psql', [dbUrl, '-X', '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-f', file], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
