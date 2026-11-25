// Opens the SQLite database (Node's built-in node:sqlite, no native build
// needed) and provides small query helpers. Every query uses ? placeholders
// so user input is never pasted into SQL.

import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../env';
import { migrations } from './migrations';

fs.mkdirSync(path.dirname(env.databaseFile), { recursive: true });

export const db = new DatabaseSync(env.databaseFile);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

type Params = SQLInputValue[];

export function all<T>(sql: string, ...params: Params): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function get<T>(sql: string, ...params: Params): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, ...params: Params) {
  const result = db.prepare(sql).run(...params);
  return { changes: Number(result.changes), lastId: Number(result.lastInsertRowid) };
}

// Runs fn inside a transaction: either every change is saved or none are.
export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

// Creates missing tables, then applies any migrations this database file has
// not had yet (tracked with SQLite's user_version). A brand-new database
// already has the latest schema, so it skips the migrations.
export function initDatabase() {
  const isNew = !get("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'");
  const schemaFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');
  db.exec(fs.readFileSync(schemaFile, 'utf8'));
  if (isNew) db.exec(`PRAGMA user_version = ${migrations.length}`);

  const { user_version: version } = get<{ user_version: number }>('PRAGMA user_version')!;
  migrations.slice(version).forEach((migrate, index) => {
    transaction(() => {
      migrate(db);
      db.exec(`PRAGMA user_version = ${version + index + 1}`);
    });
  });
}
