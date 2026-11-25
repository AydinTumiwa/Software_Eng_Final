import { Router } from 'express';
import { PROGRAMS } from '../../shared/config';
import { requireAuth, requirePermission } from '../auth';
import { badRequest, conflict, date, idParam, int, notFound, oneOf, str, time } from '../http';
import { coursesRepo, type CourseInput } from '../repositories/courses';
import { usersRepo } from '../repositories/users';

// The academic schedule. Teaching reservations are made from these courses.
export const coursesRouter = Router();
coursesRouter.use(requireAuth());

function parseCourse(body: Record<string, unknown>): CourseInput {
  const course = {
    code: str(body.code, 'Course code', { max: 20 }),
    name: str(body.name, 'Course name', { max: 120 }),
    program: oneOf(body.program, PROGRAMS, 'Program'),
    lecturerId: int(body.lecturerId, 'Lecturer', { min: 1 }),
    semester: str(body.semester, 'Semester', { max: 40 }),
    dayOfWeek: int(body.dayOfWeek, 'Day', { min: 1, max: 7 }),
    startTime: time(body.startTime, 'Start time'),
    endTime: time(body.endTime, 'End time'),
    startDate: date(body.startDate, 'First class date'),
    endDate: date(body.endDate, 'Last class date'),
  };
  if (course.endTime <= course.startTime) throw badRequest('The class must end after it starts.');
  if (course.endDate < course.startDate) throw badRequest('The last class date must be after the first.');
  const lecturer = usersRepo.findRowById(course.lecturerId);
  if (!lecturer || lecturer.role !== 'lecturer') throw badRequest('Choose a lecturer account.');
  return course;
}

coursesRouter.get('/', (req, res) => {
  res.json(coursesRepo.list(req.query.mine ? req.user!.id : undefined));
});

coursesRouter.get('/lecturers', (_req, res) => {
  res.json(usersRepo.listActiveByRole('lecturer'));
});

coursesRouter.post('/', requirePermission('manageSchedule'), (req, res) => {
  const id = coursesRepo.create(parseCourse(req.body ?? {}));
  res.status(201).json(coursesRepo.findById(id));
});

coursesRouter.put('/:id', requirePermission('manageSchedule'), (req, res) => {
  const id = idParam(req.params.id, 'Course');
  if (!coursesRepo.findById(id)) throw notFound('Course');
  coursesRepo.update(id, parseCourse(req.body ?? {}));
  res.json(coursesRepo.findById(id));
});

coursesRouter.delete('/:id', requirePermission('manageSchedule'), (req, res) => {
  const id = idParam(req.params.id, 'Course');
  if (!coursesRepo.findById(id)) throw notFound('Course');
  if (coursesRepo.hasBookings(id)) throw conflict('This course has bookings, so it cannot be deleted.');
  coursesRepo.delete(id);
  res.json({ ok: true });
});
