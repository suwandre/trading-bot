/**
 * Application configuration
 * Loads and validates environment variables
 */

import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

// Configuration schema
const configSchema = z.object({
  // Server
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3000),
  host: z.string().default('0.0.0.0'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // MongoDB
  mongodbUri: z.string().optional(),
  mongodbEnabled: z.coerce.boolean().default(false),

  // Binance
  binanceApiKey: z.string().optional(),
  binanceApiSecret: z.string().optional(),
  binanceTestnet: z.coerce.boolean().default(false),

  // MEXC
  mexcApiKey: z.string().optional(),
  mexcApiSecret: z.string().optional(),
  mexcTestnet: z.coerce.boolean().default(false),

  // Risk Management
  maxTotalExposure: z.coerce.number().default(10000),
  maxDailyLoss: z.coerce.number().default(500),
  maxDrawdownPercent: z.coerce.number().default(20),
  emergencyStopEnabled: z.coerce.boolean().default(true),

  // Backtesting
  backtestCacheEnabled: z.coerce.boolean().default(true),
  backtestCacheSize: z.coerce.number().default(1000),

  // WebSocket
  wsEnabled: z.coerce.boolean().default(true),
  wsHeartbeatInterval: z.coerce.number().default(30000),

  // Rate Limiting
  rateLimitEnabled: z.coerce.boolean().default(true),
  rateLimitMax: z.coerce.number().default(100),
  rateLimitWindow: z.coerce.number().default(60000),
});

// Parse and validate configuration
const parseConfig = () => {
  const rawConfig = {
    // Server
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    host: process.env.HOST,
    logLevel: process.env.LOG_LEVEL,

    // MongoDB
    mongodbUri: process.env.MONGODB_URI,
    mongodbEnabled: process.env.MONGODB_ENABLED,

    // Binance
    binanceApiKey: process.env.BINANCE_API_KEY,
    binanceApiSecret: process.env.BINANCE_API_SECRET,
    binanceTestnet: process.env.BINANCE_TESTNET,

    // MEXC
    mexcApiKey: process.env.MEXC_API_KEY,
    mexcApiSecret: process.env.MEXC_API_SECRET,
    mexcTestnet: process.env.MEXC_TESTNET,

    // Risk Management
    maxTotalExposure: process.env.MAX_TOTAL_EXPOSURE,
    maxDailyLoss: process.env.MAX_DAILY_LOSS,
    maxDrawdownPercent: process.env.MAX_DRAWDOWN_PERCENT,
    emergencyStopEnabled: process.env.EMERGENCY_STOP_ENABLED,

    // Backtesting
    backtestCacheEnabled: process.env.BACKTEST_CACHE_ENABLED,
    backtestCacheSize: process.env.BACKTEST_CACHE_SIZE,

    // WebSocket
    wsEnabled: process.env.WS_ENABLED,
    wsHeartbeatInterval: process.env.WS_HEARTBEAT_INTERVAL,

    // Rate Limiting
    rateLimitEnabled: process.env.RATE_LIMIT_ENABLED,
    rateLimitMax: process.env.RATE_LIMIT_MAX,
    rateLimitWindow: process.env.RATE_LIMIT_WINDOW,
  };

  try {
    return configSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid configuration');
    }
    throw error;
  }
};

// Export validated configuration
export const appConfig = parseConfig();

// Type for the configuration
export type AppConfig = z.infer<typeof configSchema>;
