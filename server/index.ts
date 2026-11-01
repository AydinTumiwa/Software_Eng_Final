// Entry point of the API server. In development Vite serves the website and
// forwards /api requests here; in production this server serves both.

import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { env } from './env';
import { errorHandler, notFound } from './http';
import { initDatabase } from './db/database';
import { seedIfEmpty } from './db/seed';
import { authRouter } from './routes/auth';
import { bookingsRouter } from './routes/bookings';
import { coursesRouter } from './routes/courses';
import { miscRouter } from './routes/misc';
import { usersRouter } from './routes/users';
import { vmsRouter } from './routes/vms';
import { startScheduler } from './services/scheduler';
import { emailDelivery } from './services/email';

initDatabase();
seedIfEmpty();

const app = express();
// Behind a hosting proxy, trust its X-Forwarded-Proto header so we know
// whether the visitor used HTTPS.
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'img-src': ["'self'", 'data:', 'https://res.cloudinary.com'],
        'style-src': ["'self'", "'unsafe-inline'"],
      },
    },
    strictTransportSecurity: env.forceHttps ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  }),
);

if (env.forceHttps) {
  app.use((req, res, next) => {
    if (req.secure) return next();
    res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  });
}

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

const api = express.Router();
api.use(authRouter);
api.use('/users', usersRouter);
api.use('/vms', vmsRouter);
api.use('/courses', coursesRouter);
api.use('/bookings', bookingsRouter);
api.use(miscRouter);
api.use(() => {
  throw notFound('API route');
});
app.use('/api', api);

// Serve the built website (npm run build) for every other path.
const distDir = path.resolve('dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use(errorHandler);

const useTls = env.httpsKeyFile && env.httpsCertFile;
const server = useTls
  ? https.createServer({ key: fs.readFileSync(env.httpsKeyFile!), cert: fs.readFileSync(env.httpsCertFile!) }, app)
  : http.createServer(app);

server.listen(env.port, () => {
  console.log(`API listening on ${useTls ? 'https' : 'http'}://localhost:${env.port}`);
  console.log(`Database: ${env.databaseFile}`);
  console.log(`Email delivery: ${emailDelivery === 'smtp' ? `SMTP (${env.smtp.host})` : 'email log only (no SMTP_HOST set)'}`);
  startScheduler();
});
