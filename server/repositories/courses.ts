import { all, get, run } from '../db/database';
import type { Course } from '../../shared/types';
import type { Program } from '../../shared/config';

interface CourseRow {
  id: number;
  code: string;
  name: string;
  program: Program;
  lecturer_id: number;
  lecturer_name: string;
  semester: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string;
}

export type CourseInput = Omit<Course, 'id' | 'lecturerName'>;

const SELECT = `
  SELECT c.*, u.name AS lecturer_name
  FROM courses c JOIN users u ON u.id = c.lecturer_id`;

function toCourse(row: CourseRow): Course {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    program: row.program,
    lecturerId: row.lecturer_id,
    lecturerName: row.lecturer_name,
    semester: row.semester,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

export const coursesRepo = {
  list(lecturerId?: number): Course[] {
    const rows = lecturerId
      ? all<CourseRow>(`${SELECT} WHERE c.lecturer_id = ? ORDER BY c.day_of_week, c.start_time`, lecturerId)
      : all<CourseRow>(`${SELECT} ORDER BY c.day_of_week, c.start_time`);
    return rows.map(toCourse);
  },

  findById(id: number): Course | undefined {
    const row = get<CourseRow>(`${SELECT} WHERE c.id = ?`, id);
    return row ? toCourse(row) : undefined;
  },

  create(c: CourseInput): number {
    return run(
      `INSERT INTO courses (code, name, program, lecturer_id, semester, day_of_week, start_time, end_time, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      c.code.trim(),
      c.name.trim(),
      c.program,
      c.lecturerId,
      c.semester.trim(),
      c.dayOfWeek,
      c.startTime,
      c.endTime,
      c.startDate,
      c.endDate,
    ).lastId;
  },

  update(id: number, c: CourseInput) {
    run(
      `UPDATE courses SET code = ?, name = ?, program = ?, lecturer_id = ?, semester = ?, day_of_week = ?,
         start_time = ?, end_time = ?, start_date = ?, end_date = ?
       WHERE id = ?`,
      c.code.trim(),
      c.name.trim(),
      c.program,
      c.lecturerId,
      c.semester.trim(),
      c.dayOfWeek,
      c.startTime,
      c.endTime,
      c.startDate,
      c.endDate,
      id,
    );
  },

  hasBookings(id: number): boolean {
    return !!get('SELECT 1 FROM bookings WHERE course_id = ? LIMIT 1', id);
  },

  delete(id: number) {
    run('DELETE FROM courses WHERE id = ?', id);
  },
};
