// `npm run db:reset` — deletes the database file and recreates it with the
// test data from seed.ts. Stop the server first.

import fs from 'node:fs';
import { env } from '../env';

for (const suffix of ['', '-wal', '-shm']) {
  fs.rmSync(env.databaseFile + suffix, { force: true });
}

// Imported only after the old file is gone, because opening the database
// happens as soon as this module loads.
const { initDatabase } = await import('./database');
const { seedDatabase } = await import('./seed');
initDatabase();
seedDatabase();
