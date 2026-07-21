import { pool } from '../../db/index';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import {
  calculateLibraryFine,
  LOAN_DAYS, DAILY_FINE_PAISE, MAX_BOOKS_PER_STUDENT, FINE_BLOCK_THRESHOLD_PAISE,
  type CreateBookInput, type UpdateBookInput, type IssueBookInput, type BookSearchQuery,
} from './library.types';

/**
 * LibraryService — catalogue, issue/return, fines (SRS 3.5).
 *
 * Business rules:
 * - Issue blocked if: no copies (ERR-LIB-001), student at MAX_BOOKS (ERR-LIB-004),
 *   unpaid fines >= threshold (ERR-LIB-002).
 * - Fine accrues from due_date + 1 at DAILY_FINE_PAISE (holiday-aware calc in types).
 * - available_copies changes ONLY inside the same transaction as the issue/return row.
 */
export class LibraryService {

  // ── Catalogue ──────────────────────────────────────────────

  /** Paginated, searchable catalogue. Students and librarians both use this. */
  async listBooks(query: BookSearchQuery) {
    const { page, per_page, search, category } = query;
    const params: any[] = [];
    const where: string[] = [`b.is_active = TRUE`];

    if (search) {
      params.push(`%${search}%`);
      where.push(`(b.title ILIKE $${params.length} OR b.author ILIKE $${params.length} OR b.isbn ILIKE $${params.length})`);
    }
    if (category) {
      params.push(category);
      where.push(`b.category = $${params.length}`);
    }

    const whereSql = where.join(' AND ');

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM library_books b WHERE ${whereSql}`, params);
    const total = countRows[0].total;

    params.push(per_page, (page - 1) * per_page);
    const { rows } = await pool.query(
      `SELECT b.book_id, b.isbn, b.title, b.author, b.publisher, b.category,
              b.edition, b.total_copies, b.available_copies, b.rack_number
         FROM library_books b
        WHERE ${whereSql}
        ORDER BY b.title
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      books: rows,
      meta: { page, per_page, total, total_pages: Math.ceil(total / per_page) },
    };
  }

  /** Librarian adds a book to the catalogue. */
  async createBook(input: CreateBookInput, addedBy: string) {
    if (input.isbn) {
      const dupe = await pool.query(`SELECT 1 FROM library_books WHERE isbn = $1`, [input.isbn]);
      if (dupe.rows.length > 0) {
        throw new AppError('ERR-LIB-003', `A book with ISBN ${input.isbn} already exists.`, 422);
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO library_books
         (isbn, title, author, publisher, category, edition, total_copies, available_copies, rack_number, added_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9)
       RETURNING book_id, title, total_copies, available_copies`,
      [input.isbn ?? null, input.title, input.author, input.publisher ?? null,
       input.category ?? null, input.edition ?? null, input.total_copies,
       input.rack_number ?? null, addedBy],
    );

    await this.audit(addedBy, 'LIB_BOOK_ADDED', 'library_book', String(rows[0].book_id), { title: input.title });
    return rows[0];
  }

  /** Librarian updates catalogue details. Copy counts adjusted consistently. */
  async updateBook(bookId: number, input: UpdateBookInput, updatedBy: string) {
    const { rows } = await pool.query(
      `SELECT book_id, total_copies, available_copies FROM library_books WHERE book_id = $1 AND is_active = TRUE`,
      [bookId],
    );
    if (rows.length === 0) throw new AppError('ERR-LIB-003', 'Book not found in catalogue.', 404);
    const book = rows[0];

    // If total_copies changes, shift available_copies by the same delta (floor 0)
    let newTotal = book.total_copies;
    let newAvailable = book.available_copies;
    if (input.total_copies !== undefined) {
      const delta = input.total_copies - book.total_copies;
      newTotal = input.total_copies;
      newAvailable = Math.max(0, Math.min(newTotal, book.available_copies + delta));
    }

    await pool.query(
      `UPDATE library_books SET
         isbn        = COALESCE($1, isbn),
         title       = COALESCE($2, title),
         author      = COALESCE($3, author),
         publisher   = COALESCE($4, publisher),
         category    = COALESCE($5, category),
         edition     = COALESCE($6, edition),
         rack_number = COALESCE($7, rack_number),
         total_copies = $8,
         available_copies = $9,
         updated_at = NOW()
       WHERE book_id = $10`,
      [input.isbn ?? null, input.title ?? null, input.author ?? null, input.publisher ?? null,
       input.category ?? null, input.edition ?? null, input.rack_number ?? null,
       newTotal, newAvailable, bookId],
    );

    await this.audit(updatedBy, 'LIB_BOOK_UPDATED', 'library_book', String(bookId), input as object);
  }

  // ── Issue / return ─────────────────────────────────────────

  /**
   * Issues a book to a student.
   * @throws ERR-LIB-003 book not found · ERR-LIB-001 no copies
   * @throws ERR-LIB-004 max books out · ERR-LIB-002 fine block · ERR-STU-005 no student
   */
  async issueBook(input: IssueBookInput, issuedBy: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the book row to serialize concurrent issues of the last copy
      const { rows: bookRows } = await client.query(
        `SELECT book_id, title, available_copies FROM library_books
          WHERE book_id = $1 AND is_active = TRUE FOR UPDATE`,
        [input.book_id],
      );
      if (bookRows.length === 0) throw new AppError('ERR-LIB-003', 'Book not found in catalogue.', 404);
      if (bookRows[0].available_copies < 1) {
        throw new AppError('ERR-LIB-001', 'No copies of this book are currently available.', 422);
      }

      const { rows: stuRows } = await client.query(
        `SELECT student_id FROM students WHERE student_id = $1 AND is_active = TRUE`, [input.student_id]);
      if (stuRows.length === 0) throw new AppError('ERR-STU-005', 'Student record not found.', 404);

      const { rows: outRows } = await client.query(
        `SELECT COUNT(*)::int AS out FROM library_issues WHERE student_id = $1 AND status = 'issued'`,
        [input.student_id],
      );
      if (outRows[0].out >= MAX_BOOKS_PER_STUDENT) {
        throw new AppError('ERR-LIB-004',
          `Student already has ${MAX_BOOKS_PER_STUDENT} books issued. Return one first.`, 422);
      }

      const { rows: fineRows } = await client.query(
        `SELECT COALESCE(SUM(amount_paise), 0)::int AS unpaid
           FROM library_fines WHERE student_id = $1 AND is_paid = FALSE AND waived_by IS NULL`,
        [input.student_id],
      );
      if (fineRows[0].unpaid >= FINE_BLOCK_THRESHOLD_PAISE) {
        throw new AppError('ERR-LIB-002',
          'Student has unpaid library fines above the limit. Clear fines before issuing.', 422);
      }

      const dueDate = input.due_date
        ?? new Date(Date.now() + LOAN_DAYS * 86_400_000).toISOString().slice(0, 10);

      const { rows: issueRows } = await client.query(
        `INSERT INTO library_issues (book_id, student_id, issued_by, due_date)
         VALUES ($1, $2, $3, $4)
         RETURNING issue_id, issue_date::text, due_date::text`,
        [input.book_id, input.student_id, issuedBy, dueDate],
      );

      await client.query(
        `UPDATE library_books SET available_copies = available_copies - 1, updated_at = NOW()
          WHERE book_id = $1`,
        [input.book_id],
      );

      await client.query(
        `INSERT INTO audit.access_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, 'LIB_BOOK_ISSUED', 'library_issue', $2, $3)`,
        [issuedBy, String(issueRows[0].issue_id),
         JSON.stringify({ book_id: input.book_id, student_id: input.student_id, due_date: dueDate })],
      );

      await client.query('COMMIT');
      logger.info({ message: 'Book issued', issue: issueRows[0].issue_id, book: bookRows[0].title });
      return issueRows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Returns (or marks lost) an issued book. Creates a fine row when overdue.
   * @throws ERR-LIB-005 issue not found or already returned
   */
  async returnBook(issueId: number, lost: boolean, returnedTo: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT i.issue_id, i.book_id, i.student_id, i.due_date::text AS due_date, i.status
           FROM library_issues i WHERE i.issue_id = $1 FOR UPDATE`,
        [issueId],
      );
      if (rows.length === 0 || rows[0].status !== 'issued') {
        throw new AppError('ERR-LIB-005', 'Issue record not found or already returned.', 404);
      }
      const issue = rows[0];
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      await client.query(
        `UPDATE library_issues
            SET status = $1, return_date = $2, returned_to = $3, updated_at = NOW()
          WHERE issue_id = $4`,
        [lost ? 'lost' : 'returned', today, returnedTo, issueId],
      );

      // Copies come back only on a real return, not on loss
      if (!lost) {
        await client.query(
          `UPDATE library_books SET available_copies = LEAST(total_copies, available_copies + 1),
                  updated_at = NOW()
            WHERE book_id = $1`,
          [issue.book_id],
        );
      }

      // Late fine (holiday awareness comes with system_config in Phase 3)
      let finePaise = calculateLibraryFine(issue.due_date, today, DAILY_FINE_PAISE);
      if (finePaise > 0) {
        await client.query(
          `INSERT INTO library_fines (issue_id, student_id, amount_paise, reason)
           VALUES ($1, $2, $3, $4)`,
          [issueId, issue.student_id, finePaise, lost ? 'Book lost (late)' : 'Late return'],
        );
      }

      await client.query(
        `INSERT INTO audit.access_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, 'library_issue', $3, $4)`,
        [returnedTo, lost ? 'LIB_BOOK_LOST' : 'LIB_BOOK_RETURNED', String(issueId),
         JSON.stringify({ fine_paise: finePaise })],
      );

      await client.query('COMMIT');
      return { issue_id: issueId, fine_paise: finePaise, status: lost ? 'lost' : 'returned' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Student self-service ───────────────────────────────────

  /** Student's current + past issues with live fine estimates on overdue books. */
  async getMyIssues(userId: string) {
    const { rows: stuRows } = await pool.query(
      `SELECT student_id FROM students WHERE user_id = $1`, [userId]);
    if (stuRows.length === 0) return { issues: [], unpaid_fines_paise: 0 };
    const studentId = stuRows[0].student_id;

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    const { rows: issues } = await pool.query(
      `SELECT i.issue_id, i.status, i.issue_date::text, i.due_date::text, i.return_date::text,
              b.title, b.author, b.isbn
         FROM library_issues i
         JOIN library_books b ON i.book_id = b.book_id
        WHERE i.student_id = $1
        ORDER BY i.created_at DESC
        LIMIT 50`,
      [studentId],
    );

    const { rows: fineRows } = await pool.query(
      `SELECT COALESCE(SUM(amount_paise), 0)::int AS unpaid
         FROM library_fines WHERE student_id = $1 AND is_paid = FALSE AND waived_by IS NULL`,
      [studentId],
    );

    return {
      issues: issues.map(i => ({
        ...i,
        overdue: i.status === 'issued' && i.due_date < today,
        estimated_fine_paise: i.status === 'issued'
          ? calculateLibraryFine(i.due_date, today, DAILY_FINE_PAISE)
          : 0,
      })),
      unpaid_fines_paise: fineRows[0].unpaid,
    };
  }

  // ── Fines ──────────────────────────────────────────────────

  /** Librarian view of a student's fines + issue history. */
  async getStudentLibraryRecord(studentId: number) {
    const { rows: stu } = await pool.query(
      `SELECT s.student_id, s.roll_number, u.first_name, u.last_name
         FROM students s JOIN users u ON s.user_id = u.user_id WHERE s.student_id = $1`,
      [studentId],
    );
    if (stu.length === 0) {
      throw new AppError('ERR-STU-005', 'Student record not found.', 404);
    }

    const [issues, fines] = await Promise.all([
      pool.query(
        `SELECT i.issue_id, i.status, i.issue_date::text, i.due_date::text, i.return_date::text,
                b.title, b.author
           FROM library_issues i JOIN library_books b ON i.book_id = b.book_id
          WHERE i.student_id = $1 ORDER BY i.created_at DESC LIMIT 50`,
        [studentId],
      ),
      pool.query(
        `SELECT fine_id, issue_id, amount_paise, reason, is_paid, paid_at, waived_by, created_at
           FROM library_fines WHERE student_id = $1 ORDER BY created_at DESC`,
        [studentId],
      ),
    ]);

    return {
      student: {
        student_id: stu[0].student_id,
        roll_number: stu[0].roll_number,
        name: `${stu[0].first_name} ${stu[0].last_name}`,
      },
      issues: issues.rows,
      fines: fines.rows,
      unpaid_fines_paise: fines.rows
        .filter((f: any) => !f.is_paid && !f.waived_by)
        .reduce((s: number, f: any) => s + f.amount_paise, 0),
    };
  }

  /** Librarian records a fine as paid (cash at counter). */
  async payFine(fineId: number, collectedBy: string) {
    const { rows } = await pool.query(
      `UPDATE library_fines
          SET is_paid = TRUE, paid_at = NOW(), collected_by = $1
        WHERE fine_id = $2 AND is_paid = FALSE AND waived_by IS NULL
        RETURNING fine_id, amount_paise`,
      [collectedBy, fineId],
    );
    if (rows.length === 0) throw new AppError('ERR-LIB-005', 'Fine not found or already settled.', 404);

    await this.audit(collectedBy, 'LIB_FINE_PAID', 'library_fine', String(fineId),
      { amount_paise: rows[0].amount_paise });
    return rows[0];
  }

  /** Librarian waives a fine with a mandatory reason (audited). */
  async waiveFine(fineId: number, reason: string, waivedBy: string) {
    const { rows } = await pool.query(
      `UPDATE library_fines
          SET waived_by = $1, waive_reason = $2
        WHERE fine_id = $3 AND is_paid = FALSE AND waived_by IS NULL
        RETURNING fine_id, amount_paise`,
      [waivedBy, reason, fineId],
    );
    if (rows.length === 0) throw new AppError('ERR-LIB-005', 'Fine not found or already settled.', 404);

    await this.audit(waivedBy, 'LIB_FINE_WAIVED', 'library_fine', String(fineId),
      { amount_paise: rows[0].amount_paise, reason });
    return rows[0];
  }

  /** Librarian dashboard: currently issued + overdue lists. */
  async getIssuedList(overdueOnly: boolean) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const { rows } = await pool.query(
      `SELECT i.issue_id, i.issue_date::text, i.due_date::text,
              b.title, b.author,
              s.student_id, s.roll_number, u.first_name, u.last_name
         FROM library_issues i
         JOIN library_books b ON i.book_id = b.book_id
         JOIN students s      ON i.student_id = s.student_id
         JOIN users u         ON s.user_id = u.user_id
        WHERE i.status = 'issued' ${overdueOnly ? `AND i.due_date < $1` : ''}
        ORDER BY i.due_date ASC
        LIMIT 100`,
      overdueOnly ? [today] : [],
    );
    return rows.map(r => ({
      issue_id:    r.issue_id,
      title:       r.title,
      author:      r.author,
      student_id:  r.student_id,
      roll_number: r.roll_number,
      student_name: `${r.first_name} ${r.last_name}`,
      issue_date:  r.issue_date,
      due_date:    r.due_date,
      overdue:     r.due_date < today,
      estimated_fine_paise: calculateLibraryFine(r.due_date, today, DAILY_FINE_PAISE),
    }));
  }

  // ── Helpers ────────────────────────────────────────────────

  private async audit(userId: string, action: string, resourceType: string, resourceId: string, details: object) {
    try {
      await pool.query(
        `INSERT INTO audit.access_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, action, resourceType, resourceId, JSON.stringify(details)],
      );
    } catch (err) {
      logger.error({ message: 'Audit log failed', action, error: (err as Error).message });
    }
  }
}

export const libraryService = new LibraryService();
