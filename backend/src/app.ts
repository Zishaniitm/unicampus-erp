import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';
import { closeDb } from './db/index';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import studentRoutes from './modules/student/student.routes';
import admissionRoutes from './modules/admission/admission.routes';
// Future imports (add as modules are built):


// ...

const app = express();

// ── Security headers ──────────────────────────────────────────
app.use(helmet());
app.set('trust proxy', 1); // Required when behind Nginx

// ── CORS ──────────────────────────────────────────────────────
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true, // Required for HttpOnly cookies to work cross-origin
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
}));

// ── Body parsers ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' })); // Higher limit for bulk import payloads
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Global rate limiting ───────────────────────────────────────
// Tighter limits on auth endpoints are set within the auth router
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Generous for general API
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'ERR-SYS-RATE',
      message: 'Too many requests. Please slow down.',
    },
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

// ── API Routes ────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
// Add more routes here as modules are built:
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/admission', admissionRoutes);
// app.use('/api/v1/fee', feeRoutes);
// app.use('/api/v1/library', libraryRoutes);

// ── 404 handler ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ERR-SYS-404',
      message: 'The requested endpoint does not exist.',
    },
  });
});

// ── Global error handler (MUST be last) ───────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────
if (require.main === module) {
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 UniCampus ERP API running on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`   College: ${env.COLLEGE_NAME} (${env.COLLEGE_CODE})`);
    logger.info(`   Frontend: ${env.FRONTEND_URL}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await closeDb();
      logger.info('Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export default app; // Export for testing with Supertest
