import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { PASSWORD_RESET, ROLES, checkPassword } from '../../shared/config';
import type { AppMeta, ForgotPasswordResult } from '../../shared/types';
import { endSession, requireAuth, startSession } from '../auth';
import { env } from '../env';
import { HttpError, badRequest, email, str } from '../http';
import { passwordResetsRepo } from '../repositories/passwordResets';
import { toUser, usersRepo } from '../repositories/users';
import { emailDelivery, sendEmail } from '../services/email';
import { messages } from '../services/messages';
import { passwordHelp } from '../services/passwordHelp';

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
    selfServiceReset: PASSWORD_RESET.selfService,
    aiHelp: env.aiHelp.enabled,
  };
  res.json(meta);
});

// --- Forgot password (self-service) ------------------------------------------

const resetLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many reset requests. Please wait 15 minutes and try again.' },
});

const setPasswordLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many messages. Please wait a few minutes and try again.' },
});

// Always answers the same way, so it can't be used to find out which emails
// have accounts. The link goes only to the address on file.
authRouter.post('/auth/forgot-password', resetLimiter, (req, res) => {
  if (!PASSWORD_RESET.selfService) throw new HttpError(404, 'Please ask the administrator to reset your password.');
  const address = email(req.body?.email);
  const result: ForgotPasswordResult = {
    message: 'If an account exists for that email, we have sent a link to reset the password. Check your inbox and spam folder.',
  };
  const row = usersRepo.findRowByEmail(address);
  if (row && row.is_active) {
    const token = passwordResetsRepo.create(row.id, PASSWORD_RESET.linkValidMinutes);
    const url = `${env.appUrl}/reset-password?token=${token}`;
    sendEmail(row.email, messages.passwordResetLink(row.name, url, PASSWORD_RESET.linkValidMinutes));
    if (env.demoMode && emailDelivery === 'log') result.demoLink = `/reset-password?token=${token}`;
  }
  res.json(result);
});

authRouter.get('/auth/reset-password/check', (req, res) => {
  res.json({ valid: !!passwordResetsRepo.findValid(String(req.query.token ?? '')) });
});

// Sets the new password and signs the person in.
authRouter.post('/auth/reset-password', setPasswordLimiter, (req, res) => {
  const userId = passwordResetsRepo.findValid(str(req.body?.token, 'Link', { max: 200 }));
  const row = userId ? usersRepo.findRowById(userId) : undefined;
  if (!row || !row.is_active) throw badRequest('This reset link is invalid or has expired. Please request a new one.');
  const next = str(req.body?.newPassword, 'New password', { max: 200 });
  const problems = checkPassword(next);
  if (problems.length) throw badRequest(problems.join(' '));

  usersRepo.setPassword(row.id, bcrypt.hashSync(next, 10), false);
  passwordResetsRepo.markAllUsed(row.id);
  startSession(res, row.id);
  res.json(toUser(usersRepo.findRowById(row.id)!));
});

// AI assistant that explains the steps and can offer to send a reset link.
authRouter.post('/auth/password-help', aiLimiter, (req, res, next) => {
  passwordHelp(req.body)
    .then((reply) => res.json(reply))
    .catch(next);
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
