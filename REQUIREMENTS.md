# Client requirements → implementation

How each point in the client brief ("Lab Booking System") is met, with the
files to look at. Numbers such as 21 days and 2 days are settings in
`shared/config.ts` (`BOOKING_RULES`), so they can be changed in one place.

| # | Requirement | How it is implemented | Main files |
| - | ----------- | --------------------- | ---------- |
| 1 | Lecturers and students book the lab facilities: date, time, and how long | Booking form with a start/end date range; teaching bookings also carry the class time from the schedule | `src/app/pages/NewBookingPage.tsx`, `server/services/bookings.ts` |
| 2 | Booking based on the academic schedule | **Academic schedule** page (courses, lecturer, day, time, semester dates). Teaching reservations are made *from a course*: dates, time and category come from it, and lecturers can only book their own courses | `src/app/pages/SchedulePage.tsx`, `server/routes/courses.ts` |
| 3 | AR (Academic Registry) is responsible for booking labs | Academic Registry role manages the schedule and can make teaching reservations on behalf of any lecturer (the lecturer is emailed) | `PERMISSIONS.bookOnBehalf`, `manageSchedule` |
| 4 | Virtual machines: IE, CS, IS and Backup | VMs have a category (IE / CS / IS / BACKUP), CPU, memory, storage, OS and installed software. Lab assistants manage them on **Lab resources** | `src/app/pages/ResourcesPage.tsx`, `server/routes/vms.ts` |
| 5 | Two reservation types | **Teaching reservation** (lecturer/AR, for a course) and **Backup reservation** (student) | `BOOKING_TYPES` |
| 6 | Lecturers must meet the requirement: memory, CPU, storage, software | The form asks for CPU, memory, storage and software. Only VMs with at least that CPU/memory/storage can be chosen; the software list goes to the lab assistant to install | `meetsRequirements()` in `server/services/bookings.ts` |
| 7 | Lab assistant notified by email about the schedule and requirements | Every new booking emails all lab assistants with the dates, class time, VM and full requirements, and adds a notification | `messages.labNewRequest`, `server/services/email.ts` |
| 8 | Backup system for e.g. FYP, max 2–3 weeks | Backup reservations are limited to 21 days (enforced on server and in the calendar) | `BOOKING_RULES.backupMaxDays` |
| 9 | Notify the student before the period ends to back up their data | Scheduler emails and notifies the student 3 days before a backup reservation ends | `server/services/scheduler.ts`, `messages.userBackupReminder` |
| 10 | Queue for the backup system | When no backup VM is free the request joins a first-come-first-served queue (**Backup queue** page). When a VM frees up the next request that fits is assigned and emailed | `processQueue()` in `server/services/bookings.ts`, `src/app/pages/QueuePage.tsx` |
| 11 | Lab assistants notify the system so users know it is ready | Lab tasks page: **Start configuring → Mark system ready**. Marking ready emails and notifies the user | `src/app/pages/LabTasksPage.tsx`, `BOOKING_ACTIONS.markReady` |
| 12 | After the booking the system is purged and reconfigured; give 2 days | When a booking ends it moves to *Purging* and the lab assistants are emailed. The VM can't be booked for 2 days after any booking ends | `BOOKING_RULES.purgeDays`, `findClashes()` in `server/repositories/bookings.ts` |
| 13 | Website requires credentials | Every page and API route needs a signed-in user; sessions are signed tokens in httpOnly cookies | `server/auth.ts`, `src/app/auth/AuthContext.tsx` |
| 14 | Admin registers student and lecturer credentials | **Users** page: the admin registers accounts; a temporary password is generated, shown once and emailed | `src/app/pages/UsersPage.tsx`, `server/routes/users.ts` |
| 15 | Users must change the password / can change it | Temporary passwords force a password change at first sign-in (the server refuses everything else until then). Anyone can change their password on **Profile & password** | `ChangePasswordPage.tsx`, `/api/auth/change-password` |
| 16 | Website security such as HTTPS | HTTPS redirect + HSTS in production, optional built-in TLS, security headers (Helmet), bcrypt-hashed passwords, rate-limited sign-in, parameterised SQL, server-side permission checks | `server/index.ts`, `server/routes/auth.ts` |
| 17 | Database to store the data; at least 10 test records | SQLite database (`server/data/lab-booking.db`). Test data: 13 users, 12 VMs, 11 courses, 16 bookings in every status, plus history, notifications and emails | `server/db/schema.sql`, `server/db/seed.ts` |
| 18 | UI/UX: calendar where you click the start and end date | Range calendar: click the first day, then the last. Days beyond the allowed length are disabled; free VMs for the chosen dates are listed | `NewBookingPage.tsx`, `DateRangeField.tsx` |

## Booking life cycle

```
            ┌──────── no backup VM free ────────┐
            │                                   ▼
 request ───┼──► pending ──► configuring ──► ready ──► active ──► purging ──► completed
            │      │   (lab assistant)  (lab assistant  (start   (end date   (lab assistant:
            │      │                     marks ready)    date)    passed)    purge done)
            │      └──► rejected / cancelled
            └──► queued ──(VM frees up)──► pending
```

*ready → active* and *active → purging* happen automatically (scheduler, every
15 minutes and at start-up), as do backup reminders and queue assignment.

## Assumptions to confirm with the client

- Who approves a booking: currently the lab assistant (configure/reject). There
  is no separate approval step by the AR.
- A teaching reservation holds its VM for the whole date range (all day), not
  only during class time.
- Students make backup reservations only; lecturers can make both types.
- Password resets are done by the administrator (no self-service email reset).
