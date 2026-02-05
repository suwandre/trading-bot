/**
 * MongoDB Database Connection
 */

import mongoose from 'mongoose';
import { appConfig } from './app.config';
import { createLogger } from '../utils/logger';

const logger = createLogger('Database');

export async function connectDatabase(): Promise<void> {
  if (!appConfig.mongodbEnabled) {
    logger.info('MongoDB is disabled, skipping connection');
    return;
  }

  if (!appConfig.mongodbUri) {
    logger.warn('MongoDB URI not provided, skipping connection');
    return;
  }

  try {
    logger.info('Connecting to MongoDB...');

    await mongoose.connect(appConfig.mongodbUri);

    logger.info('Connected to MongoDB successfully', {
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    });

    // Handle connection events
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error', { error });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

  } catch (error) {
    logger.error('Failed to connect to MongoDB', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!appConfig.mongodbEnabled) {
    return;
  }

  try {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB', { error });
  }
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
