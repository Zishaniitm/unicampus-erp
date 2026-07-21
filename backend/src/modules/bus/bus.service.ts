import { pool } from '../../db/index';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import { isRegistrationWindowOpen } from '../../utils/registrationWindow';
import { hostelService } from '../hostel/hostel.service';
import { currentAcademicYear, DecideRegistrationSchema } from '../hostel/hostel.types';
import type { z } from 'zod';
import type { CreateBusRouteInput, ApplyBusInput } from './bus.types';

type DecideInput = z.infer<typeof DecideRegistrationSchema>;

/**
 * BusService — routes, student bus pass registration, staff approval (SRS 3.7).
 *
 * Rules:
 * - Apply only inside an open 'bus' window (ERR-BUS-001), server-side IST.
 * - Route + stop must exist (ERR-BUS-002); capacity counts pending + approved.
 * - One live registration per student per year (partial unique index).
 */
export class BusService {

  /** Routes with live occupancy for the current year. */
  async listRoutes() {
    const year = currentAcademicYear();
    const { rows } = await pool.query(
      `SELECT r.route_id, r.route_name, r.stops, r.capacity, r.fee_per_semester_paise, r.is_active,
              COUNT(b.registration_id) FILTER (WHERE b.status IN ('pending','approved'))::int AS occupied
         FROM bus_routes r
         LEFT JOIN bus_registrations b
                ON b.route_id = r.route_id AND b.academic_year = $1
        WHERE r.is_active = TRUE
        GROUP BY r.route_id
        ORDER BY r.route_name`,
      [year],
    );
    return rows.map(r => ({ ...r, available: Math.max(0, r.capacity - r.occupied) }));
  }

  /** Staff creates a route. */
  async createRoute(input: CreateBusRouteInput, createdBy: string) {
    const dupe = await pool.query(`SELECT 1 FROM bus_routes WHERE route_name = $1`, [input.route_name]);
    if (dupe.rows.length > 0) {
      throw new AppError('ERR-BUS-002', 'A route with this name already exists.', 422);
    }

    const { rows } = await pool.query(
      `INSERT INTO bus_routes (route_name, stops, capacity, fee_per_semester_paise, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING route_id, route_name, capacity, fee_per_semester_paise`,
      [input.route_name, JSON.stringify(input.stops), input.capacity,
       input.fee_per_semester_paise, createdBy],
    );

    await this.audit(createdBy, 'BUS_ROUTE_CREATED', 'bus_route', String(rows[0].route_id),
      { name: input.route_name, stops: input.stops.length });
    return rows[0];
  }

  /**
   * Student applies for a bus pass.
   * @throws ERR-BUS-001 window closed · ERR-BUS-002 route/stop invalid or full
   * @throws ERR-STU-005 no student profile
   */
  async apply(input: ApplyBusInput, userId: string) {
    const window = await hostelService.getWindow('bus');
    if (!isRegistrationWindowOpen(window)) {
      throw new AppError('ERR-BUS-001', 'Bus registration window is not open.', 422);
    }
    const year = currentAcademicYear();

    const { rows: stuRows } = await pool.query(
      `SELECT student_id FROM students WHERE user_id = $1 AND is_active = TRUE`, [userId]);
    if (stuRows.length === 0) throw new AppError('ERR-STU-005', 'Student record not found.', 404);
    const studentId = stuRows[0].student_id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: routeRows } = await client.query(
        `SELECT route_id, route_name, stops, capacity FROM bus_routes
          WHERE route_id = $1 AND is_active = TRUE FOR UPDATE`,
        [input.route_id],
      );
      if (routeRows.length === 0) throw new AppError('ERR-BUS-002', 'Bus route not found.', 404);

      const stops: string[] = routeRows[0].stops ?? [];
      if (!stops.includes(input.stop_name)) {
        throw new AppError('ERR-BUS-002', 'The selected stop is not on this route.', 422);
      }

      const { rows: liveRows } = await client.query(
        `SELECT 1 FROM bus_registrations
          WHERE student_id = $1 AND academic_year = $2 AND status IN ('pending','approved')`,
        [studentId, year],
      );
      if (liveRows.length > 0) {
        throw new AppError('ERR-BUS-002', 'You already have an active bus registration this year.', 422);
      }

      const { rows: occRows } = await client.query(
        `SELECT COUNT(*)::int AS occupied FROM bus_registrations
          WHERE route_id = $1 AND academic_year = $2 AND status IN ('pending','approved')`,
        [input.route_id, year],
      );
      if (occRows[0].occupied >= routeRows[0].capacity) {
        throw new AppError('ERR-BUS-002', 'This route is full.', 422);
      }

      const { rows: regRows } = await client.query(
        `INSERT INTO bus_registrations (student_id, route_id, stop_name, academic_year)
         VALUES ($1, $2, $3, $4)
         RETURNING registration_id, status, created_at`,
        [studentId, input.route_id, input.stop_name, year],
      );

      await client.query(
        `INSERT INTO audit.access_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, 'BUS_APPLIED', 'bus_registration', $2, $3)`,
        [userId, String(regRows[0].registration_id),
         JSON.stringify({ route_id: input.route_id, stop: input.stop_name, year })],
      );

      await client.query('COMMIT');
      logger.info({ message: 'Bus application submitted', registration: regRows[0].registration_id });
      return regRows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Student's registration for the current year + window status. */
  async getMyRegistration(userId: string) {
    const year = currentAcademicYear();
    const { rows } = await pool.query(
      `SELECT b.registration_id, b.status, b.stop_name, b.remarks, b.created_at, b.decided_at,
              r.route_name, r.fee_per_semester_paise
         FROM bus_registrations b
         JOIN bus_routes r ON b.route_id = r.route_id
         JOIN students s   ON b.student_id = s.student_id
        WHERE s.user_id = $1 AND b.academic_year = $2
        ORDER BY b.created_at DESC
        LIMIT 5`,
      [userId, year],
    );
    return { window: await hostelService.getWindow('bus'), registrations: rows };
  }

  /** Pending queue for staff. */
  async listPending() {
    const year = currentAcademicYear();
    const { rows } = await pool.query(
      `SELECT b.registration_id, b.stop_name, b.created_at,
              r.route_name,
              s.student_id, s.roll_number, u.first_name, u.last_name
         FROM bus_registrations b
         JOIN bus_routes r ON b.route_id = r.route_id
         JOIN students s   ON b.student_id = s.student_id
         JOIN users u      ON s.user_id = u.user_id
        WHERE b.academic_year = $1 AND b.status = 'pending'
        ORDER BY b.created_at ASC`,
      [year],
    );
    return rows.map(r => ({
      registration_id: r.registration_id,
      route_name:      r.route_name,
      stop_name:       r.stop_name,
      student_id:      r.student_id,
      roll_number:     r.roll_number,
      student_name:    `${r.first_name} ${r.last_name}`,
      created_at:      r.created_at,
    }));
  }

  /** Staff approves/rejects. @throws ERR-BUS-002 not found or decided */
  async decide(input: DecideInput, decidedBy: string) {
    const { rows } = await pool.query(
      `UPDATE bus_registrations
          SET status = $1, remarks = COALESCE($2, remarks),
              decided_by = $3, decided_at = NOW(), updated_at = NOW()
        WHERE registration_id = $4 AND status = 'pending'
        RETURNING registration_id, status`,
      [input.decision, input.remarks ?? null, decidedBy, input.registration_id],
    );
    if (rows.length === 0) {
      throw new AppError('ERR-BUS-002', 'Registration not found or already decided.', 404);
    }

    await this.audit(decidedBy, 'BUS_DECIDED', 'bus_registration',
      String(input.registration_id), { decision: input.decision });
    return rows[0];
  }

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

export const busService = new BusService();
