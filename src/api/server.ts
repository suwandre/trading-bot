/**
 * Fastify Server
 * Main API server with REST endpoints and WebSocket support
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { appConfig } from '../config/app.config';
import { logger } from '../utils/logger';

// Import routes
import { strategyRoutes } from './routes/strategies';
import { positionRoutes } from './routes/positions';
import { tradeRoutes } from './routes/trades';
import { backtestRoutes } from './routes/backtest';
import { healthRoutes } from './routes/health';

// Import WebSocket handler
import { setupWebSocket } from './websocket/handlers';

export async function createServer() {
  const server = Fastify({
    logger: logger as any,
    requestIdLogLabel: 'reqId',
    disableRequestLogging: false,
    trustProxy: true,
  });

  // Register plugins
  await server.register(cors, {
    origin: true, // Allow all origins in development
    credentials: true,
  });

  if (appConfig.wsEnabled) {
    await server.register(websocket);
  }

  // Health check (no prefix)
  await server.register(healthRoutes);

  // API routes
  await server.register(strategyRoutes, { prefix: '/api/strategies' });
  await server.register(positionRoutes, { prefix: '/api/positions' });
  await server.register(tradeRoutes, { prefix: '/api/trades' });
  await server.register(backtestRoutes, { prefix: '/api/backtest' });

  // WebSocket
  if (appConfig.wsEnabled) {
    await setupWebSocket(server);
  }

  // Error handler
  server.setErrorHandler((error, request, reply) => {
    logger.error('Request error', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
    });

    reply.status(error.statusCode || 500).send({
      error: error.name,
      message: error.message,
      statusCode: error.statusCode || 500,
    });
  });

  // Not found handler
  server.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
      statusCode: 404,
    });
  });

  return server;
}

export async function startServer() {
  const server = await createServer();

  try {
    await server.listen({
      port: appConfig.port,
      host: appConfig.host,
    });

    logger.info('Server started', {
      port: appConfig.port,
      host: appConfig.host,
      env: appConfig.nodeEnv,
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}
