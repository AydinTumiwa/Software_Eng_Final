# AI Lab Booking System

Web app for booking virtual machines in the university AI Lab. Lecturers and the
Academic Registry reserve VMs for courses on the academic schedule. Students
reserve backup VMs (for example for their final year project), with a queue when
none are free. Lab assistants get emailed requests, configure the VMs, mark them
ready, and purge them after each booking.

See [REQUIREMENTS.md](REQUIREMENTS.md) for how each client requirement is implemented.

## Running it

You need **Node.js 22.13 or newer** (it uses Node's built-in SQLite).

```bash
npm install
npm run dev
```

This starts the API on http://localhost:3001 and the website on http://localhost:5173
(open that one). On first start the database is created in `server/data/` and
filled with test data.

| Command            | What it does                                                       |
| ------------------ | ------------------------------------------------------------------ |
| `npm run dev`      | API + website with auto-reload                                     |
| `npm run db:reset` | Delete the database and reload the test data (stop the server first) |
| `npm run build`    | Build the website into `dist/`                                     |
| `npm start`        | Run the server; it also serves `dist/` (use after `npm run build`) |
| `npm run typecheck`| Type-check the website and the server                              |

### Test accounts

Every seeded account uses the password `Password123`. In demo mode the sign-in
page has buttons that fill these in.

| Role              | Email                      |
| ----------------- | -------------------------- |
| Administrator     | admin@univ.test            |
| Academic Registry | registry@univ.test         |
| Lab Assistant     | budi.lab@univ.test, sari.lab@univ.test |
| Lecturer          | andi.wijaya@univ.test (CS), maya.putri@univ.test (IS), hendra.gunawan@univ.test (IE) |
| Student           | kevin.tan@univ.test, nadia.rahman@univ.test, fajar.pratama@univ.test, clara.lim@univ.test, rizky.hidayat@univ.test |
| Student (first sign-in) | tasya.halim@univ.test — must change the password before continuing |

The `.test` domain never receives real mail, so the seed data is safe even with
SMTP turned on.

### Settings

Copy `.env.example` to `.env` to change settings: port, database file, email
(SMTP), HTTPS certificate, session length, demo mode. Without SMTP settings,
emails are only saved to the **Email log** page.

## Project layout

```
shared/            Used by both server and website
  config.ts        ← business rules, roles, permissions, labels (start here)
  types.ts         Shapes of the data the API sends
  dates.ts         Date helpers
server/
  index.ts         Express app: security headers, HTTPS, routes
  env.ts           Settings from .env
  auth.ts          Sign-in sessions and permission checks
  db/              schema.sql, migrations.ts, seed.ts (test data), reset.ts
  repositories/    All SQL queries, one file per table
  services/        Booking rules, backup queue, scheduler, email + wording
  routes/          API endpoints
src/app/
  api/client.ts    Every API call the website makes
  auth/            Signed-in user + route guards
  navigation.tsx   Sidebar/mobile menu items and who sees them
  routes.tsx       Page URLs
  pages/           One file per page
  components/      Shared pieces (booking card, status badge, ui/ = shadcn)
```

## Changing things later

Most new client requirements touch one of these places:

| Change | Where |
| ------ | ----- |
| Backup limit (21 days), reminder timing, purge window (2 days), teaching limit | `BOOKING_RULES` in `shared/config.ts` |
| Who can do what (e.g. let lecturers manage VMs) | `PERMISSIONS` in `shared/config.ts` |
| Add a role | `ROLES` + `ROLE_LABELS` + `PERMISSIONS` in `shared/config.ts` |
| Add a VM category or program | `VM_CATEGORIES` / `PROGRAMS` + labels in `shared/config.ts` |
| Software list, CPU/memory/storage options, OS list | `SOFTWARE_CATALOG`, `SPEC_OPTIONS`, `OS_OPTIONS` in `shared/config.ts` |
| Booking statuses and the buttons that change them | `BOOKING_STATUSES`, `BOOKING_ACTIONS` in `shared/config.ts`; side effects (emails) in `server/services/bookings.ts` |
| Automatic date-based changes (start, end, reminders) | `server/services/scheduler.ts` |
| Email and notification wording | `server/services/messages.ts` |
| Who receives lab emails | `LAB_ASSISTANT_EMAILS` in `.env` (default: every lab assistant account) |
| Password rules | `PASSWORD_RULES` in `shared/config.ts` |
| New database column | `server/db/schema.sql` **and** a step in `server/db/migrations.ts` |
| New page | `src/app/pages/`, then `routes.tsx` and `navigation.tsx` |
| New API endpoint | `server/routes/`, then a function in `src/app/api/client.ts` |
| Test data | `server/db/seed.ts`, then `npm run db:reset` |

## Deploying with HTTPS

The server serves both the API and the built website, so one Node host is enough
(for example Render or Railway, which give you HTTPS automatically):

1. Build command: `npm install && npm run build`. Start command: `npm start`.
2. Set `NODE_ENV=production`, a random `JWT_SECRET` (32+ characters), and
   `APP_URL` (the public URL, used in email links).
3. Keep the database on a persistent disk: point `DATABASE_FILE` at it.
4. Optional: SMTP settings so emails are really sent.

In production the server redirects plain HTTP to HTTPS, sends HSTS and other
security headers, and only sends the session cookie over HTTPS. To serve HTTPS
directly from this server instead, set `HTTPS_CERT_FILE` and `HTTPS_KEY_FILE`.

Vercel's static hosting (`vercel.json`) only serves the website, not the API and
database, so it isn't enough on its own any more.
