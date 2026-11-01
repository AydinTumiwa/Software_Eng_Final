import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { ROLES, checkPassword } from '../../shared/config';
import type { AppMeta } from '../../shared/types';
import { endSession, requireAuth, startSession } from '../auth';
import { env } from '../env';
import { HttpError, badRequest, str } from '../http';
import { toUser, usersRepo } from '../repositories/users';
import { emailDelivery } from '../services/email';

export const authRouter = Router();

// Compared against when the email is unknown, so both cases take as long.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
});

authRouter.get('/meta', (_req, res) => {
  const users = usersRepo.list().filter((u) => u.isActive);
  const meta: AppMeta = {
    demoMode: env.demoMode,
    demoPassword: env.demoMode ? env.seedPassword : null,
    demoAccounts: env.demoMode
      ? ROLES.flatMap((role) => {
          const u = users.find((x) => x.role === role);
          return u ? [{ email: u.email, name: u.name, role }] : [];
        })
      : [],
    emailDelivery,
  };
  res.json(meta);
});

authRouter.post('/auth/login', loginLimiter, (req, res) => {
  const email = str(req.body?.email, 'Email', { max: 254 });
  const password = str(req.body?.password, 'Password', { max: 200 });
  const row = usersRepo.findRowByEmail(email);
  const ok = bcrypt.compareSync(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) throw new HttpError(401, 'Incorrect email or password.');
  if (!row.is_active) throw new HttpError(403, 'This account has been deactivated. Please contact the administrator.');
  startSession(res, row.id);
  res.json(toUser(row));
});

authRouter.post('/auth/logout', (_req, res) => {
  endSession(res);
  res.json({ ok: true });
});

authRouter.get('/auth/me', requireAuth({ allowPendingPasswordChange: true }), (req, res) => {
  res.json(req.user);
});

authRouter.post('/auth/change-password', requireAuth({ allowPendingPasswordChange: true }), (req, res) => {
  const current = str(req.body?.currentPassword, 'Current password', { max: 200 });
  const next = str(req.body?.newPassword, 'New password', { max: 200 });
  const row = usersRepo.findRowById(req.user!.id)!;
  if (!bcrypt.compareSync(current, row.password_hash)) throw badRequest('Your current password is incorrect.');
  if (current === next) throw badRequest('Choose a password different from your current one.');
  const problems = checkPassword(next);
  if (problems.length) throw badRequest(problems.join(' '));

  usersRepo.setPassword(row.id, bcrypt.hashSync(next, 10), false);
  res.json(toUser(usersRepo.findRowById(row.id)!));
});
