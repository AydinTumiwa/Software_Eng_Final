import { all, run } from '../db/database';
import type { EmailLogEntry, Notification } from '../../shared/types';

export const notificationsRepo = {
  listForUser(userId: number, limit = 30): Notification[] {
    return all<{
      id: number;
      type: string;
      title: string;
      message: string;
      link: string | null;
      is_read: number;
      created_at: string;
    }>('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?', userId, limit).map(
      (n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        link: n.link,
        isRead: !!n.is_read,
        createdAt: n.created_at,
      }),
    );
  },

  create(userId: number, type: string, title: string, message: string, link: string | null) {
    run('INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)', userId, type, title, message, link);
  },

  markRead(userId: number, id?: number) {
    if (id) run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id = ?', userId, id);
    else run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', userId);
  },
};

export const emailLogRepo = {
  list(limit = 200): EmailLogEntry[] {
    return all<{
      id: number;
      to_email: string;
      subject: string;
      body: string;
      status: EmailLogEntry['status'];
      error: string | null;
      created_at: string;
    }>('SELECT * FROM email_log ORDER BY created_at DESC, id DESC LIMIT ?', limit).map((e) => ({
      id: e.id,
      to: e.to_email,
      subject: e.subject,
      body: e.body,
      status: e.status,
      error: e.error,
      createdAt: e.created_at,
    }));
  },

  create(to: string, subject: string, body: string, status: EmailLogEntry['status'], error?: string) {
    return run(
      'INSERT INTO email_log (to_email, subject, body, status, error) VALUES (?, ?, ?, ?, ?)',
      to,
      subject,
      body,
      status,
      error ?? null,
    ).lastId;
  },

  setStatus(id: number, status: EmailLogEntry['status'], error?: string) {
    run('UPDATE email_log SET status = ?, error = ? WHERE id = ?', status, error ?? null, id);
  },
};
