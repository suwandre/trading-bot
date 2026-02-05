/**
 * WebSocket Handlers
 * Real-time updates for trading bot
 */

import type { FastifyInstance } from 'fastify';
import { createLogger } from '../../utils/logger';

const logger = createLogger('WebSocket');

export async function setupWebSocket(server: FastifyInstance) {
  server.get('/ws', { websocket: true }, (connection, request) => {
    logger.info('WebSocket client connected', {
      ip: request.ip,
    });

    // Send welcome message
    connection.socket.send(
      JSON.stringify({
        type: 'connected',
        message: 'Connected to Trading Bot WebSocket',
        timestamp: Date.now(),
      })
    );

    // Handle incoming messages
    connection.socket.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        handleClientMessage(connection, data);
      } catch (error) {
        logger.error('Failed to parse WebSocket message', { error });
        connection.socket.send(
          JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
          })
        );
      }
    });

    // Handle disconnection
    connection.socket.on('close', () => {
      logger.info('WebSocket client disconnected');
    });

    // Handle errors
    connection.socket.on('error', (error) => {
      logger.error('WebSocket error', { error });
    });

    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      if (connection.socket.readyState === 1) {
        connection.socket.send(
          JSON.stringify({
            type: 'heartbeat',
            timestamp: Date.now(),
          })
        );
      }
    }, 30000);

    connection.socket.on('close', () => {
      clearInterval(heartbeat);
    });
  });

  logger.info('WebSocket server initialized');
}

function handleClientMessage(connection: any, data: any) {
  const { type, payload } = data;

  switch (type) {
    case 'subscribe:strategy':
      // Subscribe to strategy updates
      logger.debug('Client subscribed to strategy', { strategyId: payload.strategyId });
      connection.socket.send(
        JSON.stringify({
          type: 'subscribed',
          topic: 'strategy',
          strategyId: payload.strategyId,
        })
      );
      break;

    case 'subscribe:positions':
      // Subscribe to position updates
      logger.debug('Client subscribed to positions');
      connection.socket.send(
        JSON.stringify({
          type: 'subscribed',
          topic: 'positions',
        })
      );
      break;

    case 'ping':
      // Respond to ping
      connection.socket.send(
        JSON.stringify({
          type: 'pong',
          timestamp: Date.now(),
        })
      );
      break;

    default:
      logger.warn('Unknown WebSocket message type', { type });
      connection.socket.send(
        JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${type}`,
        })
      );
  }
}

// Helper to broadcast to all connected clients
export function broadcastToAll(server: FastifyInstance, message: any) {
  // TODO: Implement broadcasting to all WebSocket clients
  // This would require tracking all connections
  logger.debug('Broadcasting message', { type: message.type });
}
