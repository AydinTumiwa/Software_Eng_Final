// Upgrades for databases created by an older version of the schema.
//
// schema.sql always describes the latest tables, so a brand-new database is
// already up to date. When you change the schema later, also append a step
// here that makes the same change to an existing database, for example:
//
//   (db) => db.exec('ALTER TABLE vms ADD COLUMN gpu TEXT'),
//
// Steps run once each, in order. Never edit or remove a step that has
// already been released; add a new one instead.

import type { DatabaseSync } from 'node:sqlite';

export const migrations: ((db: DatabaseSync) => void)[] = [];
