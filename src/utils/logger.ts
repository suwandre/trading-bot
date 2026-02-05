/**
 * Structured logging utility using Pino
 */

import pino from 'pino';
import { appConfig } from '../config/app.config';

// Create logger instance
export const logger = pino({
  level: appConfig.logLevel,
  transport:
    appConfig.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Create child loggers for different components
export const createLogger = (component: string) => {
  return logger.child({ component });
};

// Log types for structured logging
export interface LogContext {
  strategyId?: string;
  orderId?: string;
  positionId?: string;
  tradeId?: string;
  symbol?: string;
  [key: string]: any;
}

// Helper functions for common log patterns
export const logStrategyEvent = (
  level: 'info' | 'warn' | 'error',
  strategyId: string,
  event: string,
  context?: LogContext
) => {
  logger[level]({ strategyId, event, ...context }, `Strategy ${event}`);
};

export const logOrderEvent = (
  level: 'info' | 'warn' | 'error',
  orderId: string,
  event: string,
  context?: LogContext
) => {
  logger[level]({ orderId, event, ...context }, `Order ${event}`);
};

export const logTradeEvent = (
  level: 'info' | 'warn' | 'error',
  tradeId: string,
  event: string,
  context?: LogContext
) => {
  logger[level]({ tradeId, event, ...context }, `Trade ${event}`);
};

export const logError = (error: Error, context?: LogContext) => {
  logger.error(
    {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    },
    error.message
  );
};

export default logger;
