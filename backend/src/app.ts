import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';
import { closeDb } from './db/index';

// ── Route imports ─────────────────────────────────────────────
import authRoutes       from './modules/auth/auth.routes';
import studentRoutes    from './modules/student/student.routes';
import admissionRoutes  from './modules/admission/admission.routes';
import timetableRoutes  from './modules/timetable/timetable.routes';
import noticeRoutes     from './modules/notice/notice.routes';
import feeRoutes        from './modules/fee/fee.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import libraryRoutes    from './modules/library/library.routes';
import grievanceRoutes  from './modules/grievance/grievance.routes';

const app = express();

// ── Security headers ──────────────────────────────────────────
app.use(helmet());
app.set('trust proxy', 1);

// ── CORS ──────────────────────────────────────────────────────
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
}));

// ── Body parsers ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Global rate limiting ──────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'ERR-SYS-RATE', message: 'Too many requests. Please slow down.' },
  },
}));

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'UniCampus ERP API',
    version: '1.0.0',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes (Week 3 — all active modules) ──────────────────
app.use('/api/v1/auth',       authRoutes);
app.use('/api/v1/students',   studentRoutes);
app.use('/api/v1/admission',  admissionRoutes);
app.use('/api/v1/timetable',  timetableRoutes);
app.use('/api/v1/notices',    noticeRoutes);
app.use('/api/v1/fee',        feeRoutes);        // stub — full impl Week 11
app.use('/api/v1/attendance', attendanceRoutes); // stub — full impl Week 4
app.use('/api/v1/library',    libraryRoutes);    // stub — full impl Week 15
app.use('/api/v1/grievances', grievanceRoutes);  // Week 6

// ── 404 handler ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'ERR-SYS-404', message: 'The requested endpoint does not exist.' },
  });
});

// ── Global error handler (MUST be last) ──────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────
if (require.main === module) {
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 UniCampus ERP API running on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`   College: ${env.COLLEGE_NAME} (${env.COLLEGE_CODE})`);
    logger.info(`   Frontend: ${env.FRONTEND_URL}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await closeDb();
      logger.info('Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

export default app;
