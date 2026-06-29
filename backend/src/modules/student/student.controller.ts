import { Request, Response, NextFunction } from 'express';
import { studentService } from './student.service';
import {
  CreateStudentSchema,
  UpdateStudentSchema,
  AdminUpdateStudentSchema,
  StudentListQuerySchema,
  SetAcademicHoldSchema,
} from './student.types';

export class StudentController {
  /** GET /api/v1/students */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = StudentListQuerySchema.parse(req.query);
      const result = await studentService.listStudents(query, req.user!);
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/students/:id */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = parseInt(req.params.id, 10);
      if (isNaN(studentId)) throw new Error('Invalid student ID');
      const student = await studentService.getStudentById(studentId, req.user!);
      res.json({ success: true, data: student });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/students */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = CreateStudentSchema.parse(req.body);
      const result = await studentService.createStudent(input, req.user!.user_id);
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  /** PATCH /api/v1/students/:id */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = parseInt(req.params.id, 10);
      const isStaff = ['SUPER_ADMIN', 'STAFF', 'HOD', 'ADMISSION_STAFF'].includes(req.user!.role);
      const schema = isStaff ? AdminUpdateStudentSchema : UpdateStudentSchema;
      const input = schema.parse(req.body);
      await studentService.updateStudent(studentId, input as any, req.user!);
      res.json({ success: true, data: { message: 'Student updated.' } });
    } catch (err) { next(err); }
  }

  /** PATCH /api/v1/students/:id/academic-hold */
  async setAcademicHold(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = parseInt(req.params.id, 10);
      const input = SetAcademicHoldSchema.parse(req.body);
      await studentService.setAcademicHold(studentId, input, req.user!);
      res.json({ success: true, data: { message: `Academic hold ${input.hold ? 'placed' : 'removed'}.` } });
    } catch (err) { next(err); }
  }
}

export const studentController = new StudentController();
