/**
 * Health Check Routes
 */

import type { FastifyInstance } from 'fastify';
import { appConfig } from '../../config/app.config';

export async function healthRoutes(server: FastifyInstance) {
  // Health check endpoint
  server.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: appConfig.nodeEnv,
      services: {
        database: appConfig.mongodbEnabled ? 'enabled' : 'disabled',
        websocket: appConfig.wsEnabled ? 'enabled' : 'disabled',
      },
    };
  });

  // Readiness check
  server.get('/ready', async (request, reply) => {
    // Check if all services are ready
    // For now, always return ready
    return {
      ready: true,
      timestamp: Date.now(),
    };
  });

  // Liveness check
  server.get('/live', async (request, reply) => {
    return {
      alive: true,
      timestamp: Date.now(),
    };
  });
}
