import { all, get, run } from '../db/database';
import type { User } from '../../shared/types';
import type { Program, Role } from '../../shared/config';

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  program: Program | null;
  student_id: string | null;
  must_change_password: number;
  is_active: number;
  created_at: string;
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    program: row.program,
    studentId: row.student_id,
    mustChangePassword: !!row.must_change_password,
    isActive: !!row.is_active,
    createdAt: row.created_at,
  };
}

export interface NewUser {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  program?: Program | null;
  studentId?: string | null;
  mustChangePassword?: boolean;
}

export const usersRepo = {
  findRowById(id: number) {
    return get<UserRow>('SELECT * FROM users WHERE id = ?', id);
  },

  findRowByEmail(email: string) {
    return get<UserRow>('SELECT * FROM users WHERE email = ?', email.trim());
  },

  list(): User[] {
    return all<UserRow>('SELECT * FROM users ORDER BY role, name').map(toUser);
  },

  listActiveByRole(role: Role): User[] {
    return all<UserRow>('SELECT * FROM users WHERE role = ? AND is_active = 1 ORDER BY name', role).map(toUser);
  },

  create(user: NewUser): number {
    return run(
      `INSERT INTO users (name, email, password_hash, role, program, student_id, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      user.name.trim(),
      user.email.trim().toLowerCase(),
      user.passwordHash,
      user.role,
      user.program ?? null,
      user.studentId ?? null,
      user.mustChangePassword === false ? 0 : 1,
    ).lastId;
  },

  update(id: number, fields: { name: string; role: Role; program: Program | null; studentId: string | null; isActive: boolean }) {
    run(
      `UPDATE users SET name = ?, role = ?, program = ?, student_id = ?, is_active = ?, updated_at = datetime('now')
       WHERE id = ?`,
      fields.name.trim(),
      fields.role,
      fields.program,
      fields.studentId,
      fields.isActive ? 1 : 0,
      id,
    );
  },

  setPassword(id: number, passwordHash: string, mustChangePassword: boolean) {
    run(
      `UPDATE users SET password_hash = ?, must_change_password = ?, updated_at = datetime('now') WHERE id = ?`,
      passwordHash,
      mustChangePassword ? 1 : 0,
      id,
    );
  },
};
