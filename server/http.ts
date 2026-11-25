// Error type and input checks shared by the API routes. Throwing an HttpError
// anywhere in a route sends that status and message to the browser.

import type { ErrorRequestHandler } from 'express';
import { isISODate } from '../shared/dates';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const forbidden = (message = 'You do not have permission to do that.') => new HttpError(403, message);
export const notFound = (what = 'Item') => new HttpError(404, `${what} not found.`);
export const conflict = (message: string) => new HttpError(409, message);

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Request body is not valid JSON.' });
    return;
  }
  if (String(error?.message).includes('UNIQUE constraint failed')) {
    res.status(409).json({ error: 'That value is already in use.' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Something went wrong on the server.' });
};

// --- Input checks ----------------------------------------------------------

export function str(value: unknown, field: string, { max = 200, optional = false } = {}): string {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (optional) return '';
    throw badRequest(`${field} is required.`);
  }
  if (typeof value !== 'string') throw badRequest(`${field} must be text.`);
  if (value.length > max) throw badRequest(`${field} must be at most ${max} characters.`);
  return value.trim();
}

export function optionalStr(value: unknown, field: string, max = 2000): string | null {
  return str(value, field, { max, optional: true }) || null;
}

export function int(value: unknown, field: string, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
    throw badRequest(`${field} must be a whole number between ${min} and ${max}.`);
  }
  return n;
}

export function oneOf<T extends string>(value: unknown, options: readonly T[], field: string): T {
  if (!options.includes(value as T)) throw badRequest(`${field} must be one of: ${options.join(', ')}.`);
  return value as T;
}

export function date(value: unknown, field: string): string {
  if (!isISODate(value)) throw badRequest(`${field} must be a date in YYYY-MM-DD format.`);
  return value;
}

export function time(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw badRequest(`${field} must be a time in HH:MM format.`);
  }
  return value;
}

export function email(value: unknown, field = 'Email'): string {
  const v = str(value, field, { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw badRequest(`${field} is not a valid email address.`);
  return v;
}

export function stringList(value: unknown, field: string, allowed?: readonly string[]): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) throw badRequest(`${field} must be a list.`);
  const list = [...new Set(value.map((v: string) => v.trim()).filter(Boolean))];
  if (allowed) {
    const unknown = list.filter((v) => !allowed.includes(v));
    if (unknown.length) throw badRequest(`${field} contains unknown items: ${unknown.join(', ')}.`);
  }
  return list;
}

export function idParam(value: string | undefined, what = 'Item'): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw notFound(what);
  return n;
}
