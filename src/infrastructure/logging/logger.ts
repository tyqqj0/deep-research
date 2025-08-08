// @/infrastructure/logging/Logger.ts
import pino, { Logger as PinoLogger } from 'pino';
import configService from '@/config';

const logLevel = process.env.LOG_LEVEL || 'info';

/**
 * A singleton Logger class that wraps a pino instance.
 * This ensures a consistent logger configuration throughout the application.
 */
export class Logger {
  private static instance: PinoLogger;

  private constructor() {} // Private constructor to prevent direct instantiation

  public static getInstance(): PinoLogger {
    if (!Logger.instance) {
      Logger.instance = pino({
        level: logLevel,
        ...(configService.get('NODE_ENV') === 'development' && {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
            },
          },
        }),
      });
    }
    return Logger.instance;
  }
}

