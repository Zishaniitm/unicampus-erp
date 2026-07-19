import { pool } from '../../db/index';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import {
  calculateFeeBalance,
  type FeeAssignmentRow,
  type ConcessionRow,
  type PaymentRow,
  type FeeBalanceResult,
  type CreateFeeHeadInput,
  type CreateFeeAssignmentInput,
  type GrantConcessionInput,
  type RecordOfflinePaymentInput,
} from './fee.types';
import {
  createRazorpayOrder,
  verifyRazorpayWebhookSignature,
} from '../../utils/razorpay';

/**
 * FeeService — fee heads, assignments, concessions, payments, ledger.
 *
 * Money is handled in PAISE (integers) end-to-end. Only the presentation
 * layer divides by 100.
 *
 * Payment safety (SRS Section 6):
 * - Online payments are confirmed ONLY by the Razorpay webhook after signature
 *   verification (ERR-FEE-005 on mismatch).
 * - razorpay_order_id is the idempotency key — a duplicate webhook or a repeated
 *   order for the same id must not double-post to the ledger (ERR-FEE-006).
 * - Status flow CREATED → PENDING → SUCCESS | FAILED is never skipped.
 */
export class FeeService {

  // ── Student-facing reads ───────────────────────────────────

  /**
   * Resolves the internal student_id + batch for a user, or throws.
   * @throws AppError ERR-STU-005 if the user has no student profile
   */
  private async requireStudent(userId: string): Promise<{ student_id: number; batch_id: number }> {
    const { rows } = await pool.query(
      `SELECT student_id, batch_id FROM students WHERE user_id = $1 AND is_active = TRUE`,
      [userId],
    );
    if (rows.length === 0) {
      throw new AppError('ERR-STU-005', 'Student record not found.', 404);
    }
    return { student_id: rows[0].student_id, batch_id: rows[0].batch_id };
  }

  /**
   * Loads the raw components needed to compute a student's balance.
   * Assignments come from the student's batch; concessions + payments are per-student.
   */
  private async loadBalanceInputs(studentId: number, batchId: number): Promise<{
    assignments: FeeAssignmentRow[];
    concessions: ConcessionRow[];
    payments: PaymentRow[];
  }> {
    const [assignRes, concRes, payRes] = await Promise.all([
      pool.query(
        `SELECT assignment_id, amount_paise, due_date::text AS due_date, late_fine_per_day_paise
           FROM fee_assignments
          WHERE batch_id = $1 AND is_active = TRUE`,
        [batchId],
      ),
      pool.query(
        `SELECT assignment_id, amount_paise FROM fee_concessions WHERE student_id = $1`,
        [studentId],
      ),
      pool.query(
        `SELECT amount_paise, status FROM fee_transactions WHERE student_id = $1`,
        [studentId],
      ),
    ]);

    return {
      assignments: assignRes.rows.map(r => ({
        assignment_id: r.assignment_id,
        amount_paise:  r.amount_paise,
        due_date:      r.due_date,
        late_fine_per_day_paise: r.late_fine_per_day_paise,
      })),
      concessions: concRes.rows.map(r => ({ assignment_id: r.assignment_id, amount_paise: r.amount_paise })),
      payments:    payRes.rows.map(r => ({ amount_paise: r.amount_paise, status: r.status })),
    };
  }

  /**
   * Returns the student's current fee balance breakdown (all figures in paise).
   * @throws AppError ERR-STU-005 if no student profile
   */
  async getMyBalance(userId: string): Promise<FeeBalanceResult> {
    const { student_id, batch_id } = await this.requireStudent(userId);
    const { assignments, concessions, payments } = await this.loadBalanceInputs(student_id, batch_id);
    return calculateFeeBalance(assignments, concessions, payments);
  }

  /**
   * Returns the student's ledger lines (most recent first) plus balance summary.
   */
  async getMyLedger(userId: string) {
    const { student_id, batch_id } = await this.requireStudent(userId);

    const { rows } = await pool.query(
      `SELECT ledger_id, entry_type, amount_paise, description, posted_at
         FROM fee_ledger
        WHERE student_id = $1
        ORDER BY posted_at DESC, ledger_id DESC`,
      [student_id],
    );

    const inputs  = await this.loadBalanceInputs(student_id, batch_id);
    const balance = calculateFeeBalance(inputs.assignments, inputs.concessions, inputs.payments);

    return {
      balance,
      entries: rows.map(r => ({
        ledger_id:    r.ledger_id,
        entry_type:   r.entry_type,
        amount_paise: r.amount_paise,
        description:  r.description,
        posted_at:    r.posted_at,
      })),
    };
  }

  /**
   * Returns the student's transaction history (payments).
   */
  async getMyTransactions(userId: string) {
    const { student_id } = await this.requireStudent(userId);
    const { rows } = await pool.query(
      `SELECT transaction_id, receipt_number, amount_paise, method, status, paid_at, created_at
         FROM fee_transactions
        WHERE student_id = $1
        ORDER BY created_at DESC`,
      [student_id],
    );
    return rows;
  }

  // ── Officer: fee heads ─────────────────────────────────────

  /** Lists all fee heads. */
  async listFeeHeads() {
    const { rows } = await pool.query(
      `SELECT fee_head_id, head_code, head_name, description, is_refundable, is_active, created_at
         FROM fee_heads ORDER BY head_name`,
    );
    return rows;
  }

  /**
   * Creates a fee head.
   * @throws AppError ERR-FEE-002 if the head_code already exists
   */
  async createFeeHead(input: CreateFeeHeadInput, createdBy: string) {
    const dupe = await pool.query(`SELECT 1 FROM fee_heads WHERE head_code = $1`, [input.head_code]);
    if (dupe.rows.length > 0) {
      throw new AppError('ERR-FEE-008', `A fee head with code "${input.head_code}" already exists.`, 422);
    }

    const { rows } = await pool.query(
      `INSERT INTO fee_heads (head_code, head_name, description, is_refundable, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING fee_head_id, head_code, head_name, is_refundable, is_active`,
      [input.head_code, input.head_name, input.description ?? null, input.is_refundable ?? false, createdBy],
    );

    await this.audit(createdBy, 'FEE_HEAD_CREATED', 'fee_head', rows[0].fee_head_id.toString(),
      { head_code: input.head_code });

    return rows[0];
  }

  // ── Officer: fee assignments ───────────────────────────────

  /**
   * Assigns a fee head to a batch. Posts a DEBIT ledger line for every active
   * student in that batch so their balances reflect the new charge immediately.
   *
   * @throws AppError ERR-FEE-007 if the fee head does not exist
   */
  async createAssignment(input: CreateFeeAssignmentInput, createdBy: string) {
    const head = await pool.query(`SELECT 1 FROM fee_heads WHERE fee_head_id = $1 AND is_active = TRUE`,
      [input.fee_head_id]);
    if (head.rows.length === 0) {
      throw new AppError('ERR-FEE-007', 'Fee head not found.', 404);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO fee_assignments
           (fee_head_id, batch_id, academic_year, semester, amount_paise, due_date, late_fine_per_day_paise, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (fee_head_id, batch_id, academic_year, semester)
         DO UPDATE SET amount_paise = EXCLUDED.amount_paise,
                       due_date = EXCLUDED.due_date,
                       late_fine_per_day_paise = EXCLUDED.late_fine_per_day_paise,
                       is_active = TRUE,
                       updated_at = NOW()
         RETURNING assignment_id`,
        [input.fee_head_id, input.batch_id, input.academic_year, input.semester,
         input.amount_paise, input.due_date, input.late_fine_per_day_paise ?? 0, createdBy],
      );
      const assignmentId = rows[0].assignment_id;

      // Post DEBIT lines for each active student in the batch (skip if already posted)
      await client.query(
        `INSERT INTO fee_ledger (student_id, assignment_id, entry_type, amount_paise, description)
         SELECT s.student_id, $1, 'DEBIT', $2,
                (SELECT head_name FROM fee_heads WHERE fee_head_id = $3)
           FROM students s
          WHERE s.batch_id = $4 AND s.is_active = TRUE
            AND NOT EXISTS (
              SELECT 1 FROM fee_ledger l
               WHERE l.student_id = s.student_id AND l.assignment_id = $1 AND l.entry_type = 'DEBIT'
            )`,
        [assignmentId, input.amount_paise, input.fee_head_id, input.batch_id],
      );

      await client.query(
        `INSERT INTO audit.access_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, 'FEE_ASSIGNMENT_CREATED', 'fee_assignment', $2, $3)`,
        [createdBy, assignmentId.toString(),
         JSON.stringify({ batch_id: input.batch_id, amount_paise: input.amount_paise })],
      );

      await client.query('COMMIT');
      logger.info({ message: 'Fee assignment created', assignmentId, batch: input.batch_id });
      return { assignment_id: assignmentId };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Officer: concessions ───────────────────────────────────

  /**
   * Grants a concession to a student and posts a CREDIT ledger line.
   * @throws AppError ERR-FEE-007 if the assignment does not exist
   */
  async grantConcession(input: GrantConcessionInput, grantedBy: string) {
    const assign = await pool.query(
      `SELECT amount_paise FROM fee_assignments WHERE assignment_id = $1 AND is_active = TRUE`,
      [input.assignment_id],
    );
    if (assign.rows.length === 0) {
      throw new AppError('ERR-FEE-007', 'Fee assignment not found.', 404);
    }
    if (input.amount_paise > assign.rows[0].amount_paise) {
      throw new AppError('ERR-FEE-009', 'Concession cannot exceed the assigned fee amount.', 422);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO fee_concessions
           (student_id, assignment_id, concession_type, amount_paise, reason, granted_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING concession_id`,
        [input.student_id, input.assignment_id, input.concession_type,
         input.amount_paise, input.reason, grantedBy],
      );
      const concessionId = rows[0].concession_id;

      await client.query(
        `INSERT INTO fee_ledger (student_id, assignment_id, concession_id, entry_type, amount_paise, description)
         VALUES ($1, $2, $3, 'CREDIT', $4, $5)`,
        [input.student_id, input.assignment_id, concessionId, input.amount_paise,
         `Concession: ${input.concession_type}`],
      );

      await client.query(
        `INSERT INTO audit.access_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, 'FEE_CONCESSION_GRANTED', 'fee_concession', $2, $3)`,
        [grantedBy, concessionId.toString(),
         JSON.stringify({ student_id: input.student_id, amount_paise: input.amount_paise, type: input.concession_type })],
      );

      await client.query('COMMIT');
      return { concession_id: concessionId };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Officer: offline payment ───────────────────────────────

  /**
   * Records an offline payment (cash/cheque/DD) as an immediate SUCCESS
   * transaction, generates a receipt, and posts a CREDIT ledger line.
   * @throws AppError ERR-STU-005 if the student does not exist
   */
  async recordOfflinePayment(input: RecordOfflinePaymentInput, recordedBy: string) {
    const stu = await pool.query(`SELECT 1 FROM students WHERE student_id = $1`, [input.student_id]);
    if (stu.rows.length === 0) {
      throw new AppError('ERR-STU-005', 'Student record not found.', 404);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const receiptNumber = await this.nextReceiptNumber(client);

      const { rows } = await client.query(
        `INSERT INTO fee_transactions
           (receipt_number, student_id, amount_paise, method, status, offline_reference, recorded_by, notes, paid_at)
         VALUES ($1,$2,$3,$4,'SUCCESS',$5,$6,$7, NOW())
         RETURNING transaction_id`,
        [receiptNumber, input.student_id, input.amount_paise, input.method,
         input.offline_reference ?? null, recordedBy, input.notes ?? null],
      );
      const transactionId = rows[0].transaction_id;

      await client.query(
        `INSERT INTO fee_ledger (student_id, transaction_id, entry_type, amount_paise, description)
         VALUES ($1, $2, 'CREDIT', $3, $4)`,
        [input.student_id, transactionId, input.amount_paise,
         `Payment (${input.method}) — ${receiptNumber}`],
      );

      await client.query(
        `INSERT INTO audit.access_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, 'FEE_OFFLINE_PAYMENT', 'fee_transaction', $2, $3)`,
        [recordedBy, transactionId.toString(),
         JSON.stringify({ student_id: input.student_id, amount_paise: input.amount_paise, method: input.method })],
      );

      await client.query('COMMIT');
      logger.info({ message: 'Offline payment recorded', transactionId, receiptNumber });
      return { transaction_id: transactionId, receipt_number: receiptNumber };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Online payment: create order ───────────────────────────

  /**
   * Creates a Razorpay order and a matching CREATED transaction row.
   * Does NOT credit the ledger — that happens only on webhook confirmation.
   *
   * @throws AppError ERR-FEE-002 if amount is not positive
   * @throws AppError ERR-STU-005 if no student profile
   */
  async createPaymentOrder(userId: string, amountPaise: number) {
    if (amountPaise <= 0) {
      throw new AppError('ERR-FEE-002', 'Payment amount must be greater than zero.', 400);
    }
    const { student_id } = await this.requireStudent(userId);

    const order = await createRazorpayOrder(amountPaise, `stu_${student_id}_${Date.now()}`);

    await pool.query(
      `INSERT INTO fee_transactions
         (student_id, amount_paise, method, status, razorpay_order_id)
       VALUES ($1, $2, 'razorpay', 'CREATED', $3)`,
      [student_id, amountPaise, order.id],
    );

    return { order_id: order.id, amount_paise: amountPaise, currency: order.currency };
  }

  // ── Online payment: webhook confirmation ───────────────────

  /**
   * Handles a Razorpay webhook. Verifies the signature, then on a
   * `payment.captured` event marks the matching transaction SUCCESS, issues a
   * receipt, and posts a CREDIT ledger line — idempotently.
   *
   * @param rawBody   the RAW request body string (for signature verification)
   * @param signature the x-razorpay-signature header
   * @throws AppError ERR-FEE-005 if the signature does not verify
   */
  async handleWebhook(rawBody: string, signature: string | undefined) {
    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      throw new AppError('ERR-FEE-005', 'Razorpay webhook signature mismatch.', 400);
    }

    const body = JSON.parse(rawBody);
    const event = body?.event as string | undefined;
    const entity = body?.payload?.payment?.entity;

    // We only act on successful capture. Other events are acknowledged and ignored.
    if (event !== 'payment.captured' || !entity?.order_id) {
      return { handled: false };
    }

    const orderId   = entity.order_id as string;
    const paymentId = entity.id as string;
    const amount    = entity.amount as number;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the transaction row for this order to serialize duplicate webhooks
      const { rows } = await client.query(
        `SELECT transaction_id, student_id, status, amount_paise
           FROM fee_transactions
          WHERE razorpay_order_id = $1
          FOR UPDATE`,
        [orderId],
      );

      if (rows.length === 0) {
        // Unknown order — acknowledge without action (could be a different environment)
        await client.query('COMMIT');
        logger.warn({ message: 'Webhook for unknown order', orderId });
        return { handled: false };
      }

      const txn = rows[0];

      // Idempotency (ERR-FEE-006 territory): already settled — do nothing further.
      if (txn.status === 'SUCCESS') {
        await client.query('COMMIT');
        return { handled: true, duplicate: true };
      }

      const receiptNumber = await this.nextReceiptNumber(client);

      await client.query(
        `UPDATE fee_transactions
            SET status = 'SUCCESS',
                razorpay_payment_id = $1,
                receipt_number = $2,
                paid_at = NOW(),
                updated_at = NOW()
          WHERE transaction_id = $3`,
        [paymentId, receiptNumber, txn.transaction_id],
      );

      await client.query(
        `INSERT INTO fee_ledger (student_id, transaction_id, entry_type, amount_paise, description)
         VALUES ($1, $2, 'CREDIT', $3, $4)`,
        [txn.student_id, txn.transaction_id, amount, `Online payment — ${receiptNumber}`],
      );

      await client.query(
        `INSERT INTO audit.access_logs (user_id, action, resource_type, resource_id, details)
         VALUES (NULL, 'FEE_ONLINE_PAYMENT', 'fee_transaction', $1, $2)`,
        [txn.transaction_id.toString(),
         JSON.stringify({ order_id: orderId, payment_id: paymentId, amount_paise: amount })],
      );

      await client.query('COMMIT');
      logger.info({ message: 'Online payment confirmed', transactionId: txn.transaction_id, receiptNumber });
      return { handled: true, receipt_number: receiptNumber };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Officer: student ledger view ───────────────────────────

  /**
   * Officer view of any student's ledger + balance.
   * @throws AppError ERR-STU-005 if the student does not exist
   */
  async getStudentLedgerForOfficer(studentId: number) {
    const stu = await pool.query(
      `SELECT s.student_id, s.batch_id, s.roll_number, u.first_name, u.last_name
         FROM students s JOIN users u ON s.user_id = u.user_id
        WHERE s.student_id = $1`,
      [studentId],
    );
    if (stu.rows.length === 0) {
      throw new AppError('ERR-STU-005', 'Student record not found.', 404);
    }

    const { rows } = await pool.query(
      `SELECT ledger_id, entry_type, amount_paise, description, posted_at
         FROM fee_ledger WHERE student_id = $1 ORDER BY posted_at DESC, ledger_id DESC`,
      [studentId],
    );

    const inputs  = await this.loadBalanceInputs(studentId, stu.rows[0].batch_id);
    const balance = calculateFeeBalance(inputs.assignments, inputs.concessions, inputs.payments);

    return {
      student: {
        student_id:  stu.rows[0].student_id,
        roll_number: stu.rows[0].roll_number,
        name:        `${stu.rows[0].first_name} ${stu.rows[0].last_name}`,
      },
      balance,
      entries: rows,
    };
  }

  // ── Helpers ────────────────────────────────────────────────

  /** Generates the next receipt number `RCP-<year>-<6 digit>` using a DB sequence. */
  private async nextReceiptNumber(client: { query: (q: string, p?: any[]) => Promise<any> }): Promise<string> {
    const { rows } = await client.query(`SELECT nextval('fee_receipt_seq') AS seq`);
    const year = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 4);
    const seq  = String(rows[0].seq).padStart(6, '0');
    return `RCP-${year}-${seq}`;
  }

  /** Fire-and-forget audit log for non-transactional single writes. */
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

export const feeService = new FeeService();
