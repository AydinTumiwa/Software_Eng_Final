// Server settings read from environment variables (or a .env file in the
// project root). See .env.example for the full list.

import path from 'node:path';

try {
  process.loadEnvFile();
} catch {
  // No .env file: use the defaults below.
}

const isProduction = process.env.NODE_ENV === 'production';

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes'].includes(value.toLowerCase());
}

const jwtSecret = process.env.JWT_SECRET ?? '';
if (isProduction && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production.');
}

export const env = {
  isProduction,
  port: Number(process.env.PORT ?? 3001),
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',
  databaseFile: path.resolve(process.env.DATABASE_FILE ?? 'server/data/lab-booking.db'),
  jwtSecret: jwtSecret || 'dev-only-secret-change-me-before-deploying-0000',
  sessionHours: Number(process.env.SESSION_HOURS ?? 8),

  // HTTPS: either let the host (Render, Railway, a reverse proxy) terminate
  // TLS and set FORCE_HTTPS=true, or point these at a certificate and key.
  httpsKeyFile: process.env.HTTPS_KEY_FILE,
  httpsCertFile: process.env.HTTPS_CERT_FILE,
  forceHttps: bool(process.env.FORCE_HTTPS, isProduction),

  // Email. With no SMTP_HOST, emails are only written to the email log.
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? 'AI Lab Booking <no-reply@lab.local>',
  },
  // Optional comma-separated list. When empty, every active lab assistant
  // account receives lab emails.
  labAssistantEmails: (process.env.LAB_ASSISTANT_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean),

  // Demo mode shows the seeded test accounts on the sign-in page.
  demoMode: bool(process.env.DEMO_MODE, !isProduction),
  seedPassword: process.env.SEED_PASSWORD ?? 'Password123',
};
