import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Structured logger for UniCampus ERP.
 *
 * Every error log includes an error_id (UUID) that is returned to the client.
 * This allows any developer to grep logs for that ID and see the full context —
 * user, route, params, and full stack trace.
 *
 * Usage:
 *   logger.info('User logged in', { user_id, ip })
 *   logger.error({ error_id, code, message, stack, user_id, method, url, ip })
 */

const logFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `[${timestamp}] ${level.toUpperCase()}: ${message} ${metaStr}`;
});

const transports: winston.transport[] = [
  // Console — always active in dev
  new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'HH:mm:ss' }),
      errors({ stack: true }),
      logFormat
    ),
    silent: process.env.NODE_ENV === 'test',
  }),
];

// File transports — only in non-test environments
if (process.env.NODE_ENV !== 'test') {
  transports.push(
    new DailyRotateFile({
      filename: path.join('logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      format: combine(timestamp(), errors({ stack: true }), winston.format.json()),
    }),
    new DailyRotateFile({
      filename: path.join('logs', 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: combine(timestamp(), winston.format.json()),
    })
  );
}

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: combine(timestamp(), errors({ stack: true })),
  transports,
});
