// Test data: 13 users, 12 virtual machines, 11 courses and 16 bookings in
// every status, plus their history, notifications and emails. Dates are
// relative to the day the seed runs so the demo always looks current.
//
// The server seeds an empty database automatically. To start over, run
// `npm run db:reset`. Every seeded account uses SEED_PASSWORD
// (default "Password123").

import bcrypt from 'bcryptjs';
import type { BookingStatus, BookingType, Program, Role, VmCategory } from '../../shared/config';
import { addDays, todayISO } from '../../shared/dates';
import { env } from '../env';
import { bookingsRepo } from '../repositories/bookings';
import { coursesRepo } from '../repositories/courses';
import { emailLogRepo, notificationsRepo } from '../repositories/notifications';
import { usersRepo } from '../repositories/users';
import { vmsRepo } from '../repositories/vms';
import { messages } from '../services/messages';
import { get, run, transaction } from './database';

const USERS: { key: string; name: string; email: string; role: Role; program?: Program; studentId?: string; mustChange?: boolean }[] = [
  { key: 'admin', name: 'Rina Admin', email: 'admin@univ.test', role: 'admin' },
  { key: 'registry', name: 'Dewi Registry', email: 'registry@univ.test', role: 'academic_registry' },
  { key: 'budi', name: 'Budi Santoso', email: 'budi.lab@univ.test', role: 'lab_assistant' },
  { key: 'sari', name: 'Sari Wulandari', email: 'sari.lab@univ.test', role: 'lab_assistant' },
  { key: 'andi', name: 'Dr. Andi Wijaya', email: 'andi.wijaya@univ.test', role: 'lecturer', program: 'CS' },
  { key: 'maya', name: 'Dr. Maya Putri', email: 'maya.putri@univ.test', role: 'lecturer', program: 'IS' },
  { key: 'hendra', name: 'Dr. Hendra Gunawan', email: 'hendra.gunawan@univ.test', role: 'lecturer', program: 'IE' },
  { key: 'kevin', name: 'Kevin Tan', email: 'kevin.tan@univ.test', role: 'student', program: 'CS', studentId: '2021390001' },
  { key: 'nadia', name: 'Nadia Rahman', email: 'nadia.rahman@univ.test', role: 'student', program: 'IS', studentId: '2021390002' },
  { key: 'fajar', name: 'Fajar Pratama', email: 'fajar.pratama@univ.test', role: 'student', program: 'IE', studentId: '2021390003' },
  { key: 'clara', name: 'Clara Lim', email: 'clara.lim@univ.test', role: 'student', program: 'CS', studentId: '2022390004' },
  { key: 'rizky', name: 'Rizky Hidayat', email: 'rizky.hidayat@univ.test', role: 'student', program: 'IS', studentId: '2022390005' },
  // Shows the first sign-in flow: must replace the temporary password.
  { key: 'tasya', name: 'Tasya Halim', email: 'tasya.halim@univ.test', role: 'student', program: 'IE', studentId: '2023390006', mustChange: true },
];

const VMS: { name: string; category: VmCategory; cpu: number; mem: number; disk: number; os: string; software: string[]; status?: 'maintenance' }[] = [
  { name: 'CS-VM-01', category: 'CS', cpu: 8, mem: 32, disk: 250, os: 'Ubuntu 24.04 LTS', software: ['Python 3', 'Jupyter', 'PyTorch', 'CUDA Toolkit', 'Visual Studio Code'] },
  { name: 'CS-VM-02', category: 'CS', cpu: 16, mem: 64, disk: 500, os: 'Ubuntu 24.04 LTS', software: ['Python 3', 'Jupyter', 'TensorFlow', 'PyTorch', 'CUDA Toolkit'] },
  { name: 'CS-VM-03', category: 'CS', cpu: 4, mem: 16, disk: 100, os: 'Ubuntu 24.04 LTS', software: ['Java JDK', 'Node.js', 'Docker', 'Visual Studio Code'] },
  { name: 'IS-VM-01', category: 'IS', cpu: 4, mem: 16, disk: 250, os: 'Windows 11 Education', software: ['MySQL', 'Power BI', 'Visual Studio Code'] },
  { name: 'IS-VM-02', category: 'IS', cpu: 8, mem: 32, disk: 250, os: 'Windows 11 Education', software: ['PostgreSQL', 'Python 3', 'Power BI'] },
  { name: 'IS-VM-03', category: 'IS', cpu: 4, mem: 8, disk: 100, os: 'Windows Server 2025', software: ['MySQL'], status: 'maintenance' },
  { name: 'IE-VM-01', category: 'IE', cpu: 8, mem: 16, disk: 250, os: 'Windows 11 Education', software: ['Arena Simulation', 'Minitab', 'MATLAB'] },
  { name: 'IE-VM-02', category: 'IE', cpu: 4, mem: 16, disk: 100, os: 'Windows 11 Education', software: ['MATLAB', 'Python 3'] },
  { name: 'IE-VM-03', category: 'IE', cpu: 16, mem: 32, disk: 500, os: 'Windows 11 Education', software: ['MATLAB', 'Arena Simulation', 'Minitab'] },
  { name: 'BK-VM-01', category: 'BACKUP', cpu: 4, mem: 16, disk: 500, os: 'Ubuntu 24.04 LTS', software: ['Python 3', 'Docker'] },
  { name: 'BK-VM-02', category: 'BACKUP', cpu: 4, mem: 16, disk: 500, os: 'Ubuntu 24.04 LTS', software: ['Python 3', 'Docker'] },
  { name: 'BK-VM-03', category: 'BACKUP', cpu: 8, mem: 32, disk: 1000, os: 'Ubuntu 24.04 LTS', software: ['Python 3', 'Jupyter', 'Docker'] },
];

// Statuses a booking passed through to reach its current one, for the timeline.
const PATHS: Record<BookingStatus, BookingStatus[]> = {
  queued: ['queued'],
  pending: ['pending'],
  configuring: ['pending', 'configuring'],
  ready: ['pending', 'configuring', 'ready'],
  active: ['pending', 'configuring', 'ready', 'active'],
  purging: ['pending', 'configuring', 'ready', 'active', 'purging'],
  completed: ['pending', 'configuring', 'ready', 'active', 'purging', 'completed'],
  rejected: ['pending', 'rejected'],
  cancelled: ['pending', 'cancelled'],
};

export function seedIfEmpty() {
  const { n } = get<{ n: number }>('SELECT COUNT(*) AS n FROM users')!;
  if (n === 0) seedDatabase();
}

export function seedDatabase() {
  const T = todayISO();
  const d = (days: number) => addDays(T, days);
  const passwordHash = bcrypt.hashSync(env.seedPassword, 10);

  transaction(() => {
    const user: Record<string, number> = {};
    for (const u of USERS) {
      user[u.key] = usersRepo.create({ ...u, passwordHash, mustChangePassword: !!u.mustChange });
    }

    const vm: Record<string, number> = {};
    for (const v of VMS) {
      vm[v.name] = vmsRepo.create({
        name: v.name,
        category: v.category,
        cpuCores: v.cpu,
        memoryGb: v.mem,
        storageGb: v.disk,
        os: v.os,
        software: v.software,
        status: v.status ?? 'available',
        notes: v.status === 'maintenance' ? 'Disk replacement scheduled' : null,
      });
    }

    const semester = { semester: 'Odd 2026/2027', startDate: d(-60), endDate: d(50) };
    const nextSemester = { semester: 'Even 2026/2027', startDate: d(80), endDate: d(190) };
    const course: Record<string, number> = {};
    const courses = [
      { code: 'CS301', name: 'Machine Learning', program: 'CS', lecturer: 'andi', day: 1, start: '09:00', end: '11:30', ...semester },
      { code: 'CS205', name: 'Data Structures', program: 'CS', lecturer: 'andi', day: 3, start: '13:00', end: '15:30', ...semester },
      { code: 'CS410', name: 'Deep Learning', program: 'CS', lecturer: 'andi', day: 4, start: '09:00', end: '11:30', ...semester },
      { code: 'IS220', name: 'Database Systems', program: 'IS', lecturer: 'maya', day: 2, start: '09:00', end: '11:30', ...semester },
      { code: 'IS315', name: 'Business Intelligence', program: 'IS', lecturer: 'maya', day: 4, start: '13:00', end: '15:30', ...semester },
      { code: 'IS330', name: 'Enterprise Systems', program: 'IS', lecturer: 'maya', day: 5, start: '09:00', end: '11:30', ...semester },
      { code: 'IE210', name: 'Operations Research', program: 'IE', lecturer: 'hendra', day: 1, start: '13:00', end: '15:30', ...semester },
      { code: 'IE320', name: 'Simulation Modeling', program: 'IE', lecturer: 'hendra', day: 3, start: '09:00', end: '11:30', ...semester },
      { code: 'IE330', name: 'Quality Engineering', program: 'IE', lecturer: 'hendra', day: 5, start: '13:00', end: '15:30', ...semester },
      { code: 'CS450', name: 'Natural Language Processing', program: 'CS', lecturer: 'andi', day: 2, start: '13:00', end: '15:30', ...nextSemester },
      { code: 'IS410', name: 'Data Mining', program: 'IS', lecturer: 'maya', day: 3, start: '09:00', end: '11:30', ...nextSemester },
    ] as const;
    for (const c of courses) {
      course[c.code] = coursesRepo.create({
        code: c.code,
        name: c.name,
        program: c.program,
        lecturerId: user[c.lecturer],
        semester: c.semester,
        dayOfWeek: c.day,
        startTime: c.start,
        endTime: c.end,
        startDate: c.startDate,
        endDate: c.endDate,
      });
    }

    type Seed = {
      type: BookingType;
      status: BookingStatus;
      for: string;
      by?: string;
      vm: string | null;
      course?: string;
      start: number;
      end: number;
      req: [number, number, number, string[]];
      purpose: string;
      note?: string;
    };
    const teach = (code: string, vmName: string, status: BookingStatus, start: number, end: number, req: Seed['req'], by?: string): Seed => {
      const c = courses.find((x) => x.code === code)!;
      return { type: 'teaching', status, for: c.lecturer, by, vm: vmName, course: code, start, end, req, purpose: `${c.code} ${c.name} practical sessions` };
    };
    const bookings: Seed[] = [
      teach('CS301', 'CS-VM-01', 'active', -60, 50, [8, 32, 200, ['Python 3', 'Jupyter', 'PyTorch']]),
      teach('IS220', 'IS-VM-01', 'active', -60, 50, [4, 16, 100, ['MySQL']], 'registry'),
      teach('IE320', 'IE-VM-01', 'active', -60, 50, [8, 16, 200, ['Arena Simulation']]),
      teach('CS410', 'CS-VM-02', 'ready', 3, 50, [16, 64, 500, ['TensorFlow', 'PyTorch', 'CUDA Toolkit']]),
      teach('IS315', 'IS-VM-02', 'configuring', 7, 50, [8, 32, 250, ['Power BI', 'PostgreSQL']]),
      teach('IE210', 'IE-VM-02', 'pending', 5, 50, [4, 16, 100, ['MATLAB']], 'registry'),
      { ...teach('IE330', 'IE-VM-03', 'purging', -30, -1, [8, 16, 250, ['Minitab']]), purpose: 'IE330 Quality Engineering – SPC workshop block' },
      teach('CS205', 'CS-VM-03', 'completed', -60, -20, [4, 8, 50, ['Java JDK']]),
      { ...teach('IS330', 'IS-VM-02', 'cancelled', -10, 40, [4, 16, 100, ['MySQL']]), note: 'Class moved to the computer lab' },
      { type: 'backup', status: 'active', for: 'kevin', vm: 'BK-VM-01', start: -18, end: 2, req: [4, 16, 400, ['Python 3']], purpose: 'Final year project – model training data' },
      { type: 'backup', status: 'active', for: 'nadia', vm: 'BK-VM-02', start: -5, end: 14, req: [4, 8, 200, []], purpose: 'Final year project – survey database' },
      { type: 'backup', status: 'ready', for: 'clara', vm: 'BK-VM-03', start: 1, end: 15, req: [8, 32, 800, ['Jupyter']], purpose: 'Final year project – image dataset' },
      { type: 'backup', status: 'queued', for: 'fajar', vm: null, start: 1, end: 14, req: [4, 16, 300, []], purpose: 'Final year project – simulation results' },
      { type: 'backup', status: 'queued', for: 'rizky', vm: null, start: 3, end: 20, req: [4, 8, 150, []], purpose: 'Capstone – web app database' },
      { type: 'backup', status: 'rejected', for: 'rizky', vm: 'BK-VM-03', start: -30, end: -20, req: [8, 32, 1000, []], purpose: 'Personal file storage', note: 'Backup VMs are for academic work such as FYP only.' },
      { type: 'backup', status: 'completed', for: 'kevin', vm: 'BK-VM-02', start: -40, end: -25, req: [4, 16, 300, []], purpose: 'Final year project – early experiments' },
    ];

    bookings.forEach((s, index) => {
      const c = s.course ? coursesRepo.findById(course[s.course]) : undefined;
      const id = bookingsRepo.create({
        type: s.type,
        status: s.status,
        category: s.vm ? VMS.find((v) => v.name === s.vm)!.category : 'BACKUP',
        userId: user[s.for],
        bookedById: user[s.by ?? s.for],
        vmId: s.vm ? vm[s.vm] : null,
        courseId: c?.id ?? null,
        startDate: d(s.start),
        endDate: d(s.end),
        startTime: c?.startTime ?? null,
        endTime: c?.endTime ?? null,
        cpuCores: s.req[0],
        memoryGb: s.req[1],
        storageGb: s.req[2],
        software: s.req[3],
        purpose: s.purpose,
        notes: null,
      });
      // Spread creation times out so the queue order and history look real.
      const created = `${d(Math.min(s.start, 0) - 7)} 0${index % 9}:00:00`;
      run('UPDATE bookings SET created_at = ?, updated_at = ? WHERE id = ?', created, created, id);
      if (s.note) bookingsRepo.update(id, { status_note: s.note });
      if (['ready', 'active', 'purging', 'completed'].includes(s.status)) bookingsRepo.update(id, { ready_at: `${d(s.start - 1)}T09:00:00Z` });
      if (s.status === 'purging' || s.status === 'completed') bookingsRepo.update(id, { purge_until: d(s.end + 2) });

      const path = PATHS[s.status];
      path.forEach((status, step) => {
        const isLab = ['configuring', 'ready', 'completed'].includes(status);
        const actor = step === 0 ? user[s.by ?? s.for] : isLab ? user.budi : ['rejected'].includes(status) ? user.sari : status === 'cancelled' ? user[s.for] : null;
        bookingsRepo.addEvent(id, actor, step === 0 ? null : path[step - 1], status, status === s.status ? (s.note ?? null) : null);
      });
      run('UPDATE booking_events SET created_at = ? WHERE booking_id = ?', created, id);

      const b = bookingsRepo.findById(id)!;
      if (b.status !== 'queued') {
        for (const to of ['budi.lab@univ.test', 'sari.lab@univ.test']) {
          const m = messages.labNewRequest(b);
          emailLogRepo.create(to, m.subject, m.body, 'logged');
        }
      }
      if (['ready', 'active'].includes(b.status)) {
        const m = messages.userReady(b);
        emailLogRepo.create(b.userEmail, m.subject, m.body, 'logged');
      }

      const inApp =
        b.status === 'queued' ? messages.userQueuedInApp(b)
        : b.status === 'rejected' ? messages.userRejectedInApp(b)
        : ['ready', 'active'].includes(b.status) ? messages.userReadyInApp(b)
        : ['pending', 'configuring'].includes(b.status) ? messages.userSubmittedInApp(b)
        : null;
      if (inApp) notificationsRepo.create(b.userId, inApp.type, inApp.title, inApp.message, inApp.link);
      if (b.status === 'pending') {
        const lab = messages.labNewRequestInApp(b);
        [user.budi, user.sari].forEach((u) => notificationsRepo.create(u, lab.type, lab.title, lab.message, lab.link));
      }
    });
    run("UPDATE notifications SET is_read = 1 WHERE type IN ('ready', 'rejected')");
  });

  console.log(`Seeded test data. Every account's password is "${env.seedPassword}".`);
}
