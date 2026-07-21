import { Request, Response, NextFunction } from 'express';
import { libraryService } from './library.service';
import {
  CreateBookSchema, UpdateBookSchema, IssueBookSchema, ReturnBookSchema,
  PayFineSchema, WaiveFineSchema, BookSearchQuerySchema,
} from './library.types';

export class LibraryController {

  /** GET /api/v1/library/books — searchable catalogue (all roles) */
  async listBooks(req: Request, res: Response, next: NextFunction) {
    try {
      const query = BookSearchQuerySchema.parse(req.query);
      const { books, meta } = await libraryService.listBooks(query);
      res.json({ success: true, books, meta });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/library/books — librarian adds a book */
  async createBook(req: Request, res: Response, next: NextFunction) {
    try {
      const input = CreateBookSchema.parse(req.body);
      const data  = await libraryService.createBook(input, req.user!.user_id);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** PATCH /api/v1/library/books/:id — librarian updates a book */
  async updateBook(req: Request, res: Response, next: NextFunction) {
    try {
      const bookId = parseInt(req.params.id, 10);
      if (isNaN(bookId)) {
        res.status(400).json({ success: false, error: { code: 'ERR-VALIDATION', message: 'Invalid book ID.' } });
        return;
      }
      const input = UpdateBookSchema.parse(req.body);
      await libraryService.updateBook(bookId, input, req.user!.user_id);
      res.json({ success: true, data: { message: 'Book updated.' } });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/library/issues — librarian issues a book */
  async issueBook(req: Request, res: Response, next: NextFunction) {
    try {
      const input = IssueBookSchema.parse(req.body);
      const data  = await libraryService.issueBook(input, req.user!.user_id);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/library/returns — librarian processes a return */
  async returnBook(req: Request, res: Response, next: NextFunction) {
    try {
      const input = ReturnBookSchema.parse(req.body);
      const data  = await libraryService.returnBook(input.issue_id, input.lost ?? false, req.user!.user_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/library/my/issued — student's own issues + fines */
  async getMyIssues(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await libraryService.getMyIssues(req.user!.user_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/library/issued?overdue=true — librarian's issued/overdue list */
  async getIssuedList(req: Request, res: Response, next: NextFunction) {
    try {
      const overdueOnly = req.query.overdue === 'true';
      const data = await libraryService.getIssuedList(overdueOnly);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** GET /api/v1/library/students/:studentId — librarian views a student's record */
  async getStudentRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = parseInt(req.params.studentId, 10);
      if (isNaN(studentId)) {
        res.status(400).json({ success: false, error: { code: 'ERR-VALIDATION', message: 'Invalid student ID.' } });
        return;
      }
      const data = await libraryService.getStudentLibraryRecord(studentId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/library/fines/pay — librarian collects a fine */
  async payFine(req: Request, res: Response, next: NextFunction) {
    try {
      const input = PayFineSchema.parse(req.body);
      const data  = await libraryService.payFine(input.fine_id, req.user!.user_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /** POST /api/v1/library/fines/waive — librarian waives a fine (reason mandatory) */
  async waiveFine(req: Request, res: Response, next: NextFunction) {
    try {
      const input = WaiveFineSchema.parse(req.body);
      const data  = await libraryService.waiveFine(input.fine_id, input.reason, req.user!.user_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
}

export const libraryController = new LibraryController();
