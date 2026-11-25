import { createHash, randomBytes } from 'node:crypto';
import { get, run } from '../db/database';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export const passwordResetsRepo = {
  // Creates a new link token for the user and invalidates their older ones.
  create(userId: number, validMinutes: number): string {
    const token = randomBytes(32).toString('base64url');
    run("UPDATE password_resets SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL", userId);
    run(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      userId,
      hash(token),
      new Date(Date.now() + validMinutes * 60_000).toISOString(),
    );
    return token;
  },

  // The user id the token belongs to, if it is unused and not expired.
  findValid(token: string): number | undefined {
    const row = get<{ user_id: number; expires_at: string; used_at: string | null }>(
      'SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?',
      hash(token),
    );
    if (!row || row.used_at || row.expires_at < new Date().toISOString()) return undefined;
    return row.user_id;
  },

  markAllUsed(userId: number) {
    run("UPDATE password_resets SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL", userId);
  },
};
