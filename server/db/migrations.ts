// Upgrades for databases created by an older version of the schema.
//
// schema.sql always describes the latest tables, so a brand-new database is
// already up to date, and a brand-new table (CREATE TABLE IF NOT EXISTS) is
// added to existing databases automatically too. When you change an existing
// table, also append a step here that makes the same change, for example:
//
//   (db) => db.exec('ALTER TABLE vms ADD COLUMN gpu TEXT'),
//
// Steps run once each, in order. Never edit or remove a step that has
// already been released; add a new one instead.

import type { DatabaseSync } from 'node:sqlite';

export const migrations: ((db: DatabaseSync) => void)[] = [];
