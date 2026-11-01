// Sign-in sessions. After a successful login the server sets a signed token
// in an httpOnly cookie (JavaScript in the page cannot read it). Each request
// re-reads the user from the database, so a deactivated account or a changed
// role takes effect immediately.

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { can, type Permission } from '../shared/config';
import type { User } from '../shared/types';
import { env } from './env';
import { HttpError, forbidden } from './http';
import { toUser, usersRepo } from './repositories/users';

const COOKIE = 'lab_session';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function startSession(res: Response, userId: number) {
  const token = jwt.sign({ sub: String(userId) }, env.jwtSecret, { expiresIn: `${env.sessionHours}h` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.isProduction || env.forceHttps,
    maxAge: env.sessionHours * 3_600_000,
    path: '/',
  });
}

export function endSession(res: Response) {
  res.clearCookie(COOKIE, { path: '/' });
}

function userFromRequest(req: Request): User | undefined {
  const token = req.cookies?.[COOKIE];
  if (!token) return undefined;
  try {
    const { sub } = jwt.verify(token, env.jwtSecret) as { sub: string };
    const row = usersRepo.findRowById(Number(sub));
    return row && row.is_active ? toUser(row) : undefined;
  } catch {
    return undefined;
  }
}

// Requires a signed-in user. Until a user replaces their temporary password,
// only the routes marked allowPendingPasswordChange work.
export function requireAuth({ allowPendingPasswordChange = false } = {}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = userFromRequest(req);
    if (!user) return next(new HttpError(401, 'Please sign in.', 'UNAUTHENTICATED'));
    if (user.mustChangePassword && !allowPendingPasswordChange) {
      return next(new HttpError(403, 'Please change your temporary password first.', 'PASSWORD_CHANGE_REQUIRED'));
    }
    req.user = user;
    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    next(can(req.user?.role, permission) ? undefined : forbidden());
  };
}
