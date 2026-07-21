import { Router } from 'express';
import { libraryController } from './library.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';

/**
 * Library Routes — /api/v1/library/
 *
 * ALL AUTHENTICATED:
 *   GET  /books                     Searchable catalogue
 *
 * STUDENT:
 *   GET  /my/issued                 Own issues + fine estimates
 *
 * LIBRARIAN / SUPER_ADMIN (PRINCIPAL read-only where noted):
 *   POST  /books                    Add book
 *   PATCH /books/:id                Update book
 *   POST  /issues                   Issue a book
 *   POST  /returns                  Return / mark lost
 *   GET   /issued?overdue=true      Issued & overdue list (+PRINCIPAL)
 *   GET   /students/:studentId      Student's library record (+PRINCIPAL)
 *   POST  /fines/pay                Collect a fine
 *   POST  /fines/waive              Waive a fine (reason mandatory)
 */
const router = Router();
router.use(requireAuth);

const LIBRARIAN = ['LIBRARIAN', 'SUPER_ADMIN'];
const LIBRARIAN_READ = ['LIBRARIAN', 'SUPER_ADMIN', 'PRINCIPAL'];

// Catalogue — browsable by everyone signed in
router.get('/books', libraryController.listBooks.bind(libraryController));

// Student self-service (specific paths BEFORE parameterized ones)
router.get('/my/issued',
  requireRole(['STUDENT', 'SUPER_ADMIN']),
  libraryController.getMyIssues.bind(libraryController));

// Librarian management
router.post('/books',
  requireRole(LIBRARIAN),
  libraryController.createBook.bind(libraryController));

router.patch('/books/:id',
  requireRole(LIBRARIAN),
  libraryController.updateBook.bind(libraryController));

router.post('/issues',
  requireRole(LIBRARIAN),
  libraryController.issueBook.bind(libraryController));

router.post('/returns',
  requireRole(LIBRARIAN),
  libraryController.returnBook.bind(libraryController));

router.get('/issued',
  requireRole(LIBRARIAN_READ),
  libraryController.getIssuedList.bind(libraryController));

router.post('/fines/pay',
  requireRole(LIBRARIAN),
  libraryController.payFine.bind(libraryController));

router.post('/fines/waive',
  requireRole(LIBRARIAN),
  libraryController.waiveFine.bind(libraryController));

router.get('/students/:studentId',
  requireRole(LIBRARIAN_READ),
  libraryController.getStudentRecord.bind(libraryController));

export default router;
