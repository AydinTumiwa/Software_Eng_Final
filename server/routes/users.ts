import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { PROGRAMS, ROLES, checkPassword } from '../../shared/config';
import { requireAuth, requirePermission } from '../auth';
import { badRequest, email, idParam, notFound, oneOf, optionalStr, str } from '../http';
import { toUser, usersRepo } from '../repositories/users';
import { sendEmail } from '../services/email';
import { messages } from '../services/messages';

export const usersRouter = Router();
usersRouter.use(requireAuth(), requirePermission('manageUsers'));

// Readable temporary password, e.g. "Lab-kqvz-4821".
function tempPassword(): string {
  const letters = Array.from({ length: 4 }, () => 'abcdefghjkmnpqrstuvwxyz'[randomInt(23)]).join('');
  return `Lab-${letters}-${randomInt(1000, 10000)}`;
}

function parseProfile(body: Record<string, unknown>) {
  return {
    name: str(body.name, 'Name', { max: 120 }),
    role: oneOf(body.role, ROLES, 'Role'),
    program: body.program ? oneOf(body.program, PROGRAMS, 'Program') : null,
    studentId: optionalStr(body.studentId, 'Student ID', 40),
  };
}

usersRouter.get('/', (_req, res) => {
  res.json(usersRepo.list());
});

// Admin registers a student or staff account. The user must replace the
// temporary password the first time they sign in.
usersRouter.post('/', (req, res) => {
  const profile = parseProfile(req.body ?? {});
  const address = email(req.body?.email);
  if (usersRepo.findRowByEmail(address)) throw badRequest('An account with that email already exists.');

  const password = req.body?.password ? str(req.body.password, 'Password', { max: 200 }) : tempPassword();
  const problems = checkPassword(password);
  if (problems.length) throw badRequest(problems.join(' '));

  const id = usersRepo.create({ ...profile, email: address, passwordHash: bcrypt.hashSync(password, 10), mustChangePassword: true });
  sendEmail(address, messages.accountCreated(profile.name, address, profile.role, password));
  res.status(201).json({ user: toUser(usersRepo.findRowById(id)!), temporaryPassword: password });
});

usersRouter.patch('/:id', (req, res) => {
  const id = idParam(req.params.id, 'User');
  const row = usersRepo.findRowById(id);
  if (!row) throw notFound('User');
  const profile = parseProfile({ ...toUser(row), ...req.body });
  const isActive = req.body?.isActive === undefined ? !!row.is_active : req.body.isActive === true;
  if (id === req.user!.id && (!isActive || profile.role !== row.role)) {
    throw badRequest('You cannot deactivate your own account or change your own role.');
  }
  usersRepo.update(id, { ...profile, isActive });
  res.json(toUser(usersRepo.findRowById(id)!));
});

usersRouter.post('/:id/reset-password', (req, res) => {
  const id = idParam(req.params.id, 'User');
  const row = usersRepo.findRowById(id);
  if (!row) throw notFound('User');
  const password = tempPassword();
  usersRepo.setPassword(id, bcrypt.hashSync(password, 10), true);
  sendEmail(row.email, messages.passwordReset(row.name, password));
  res.json({ temporaryPassword: password });
});
