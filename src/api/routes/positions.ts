/**
 * Position Management Routes
 */

import type { FastifyInstance } from 'fastify';
import { PositionManager } from '../../core/position-manager';

let positionManager: PositionManager;

export function setPositionManager(manager: PositionManager) {
  positionManager = manager;
}

export async function positionRoutes(server: FastifyInstance) {
  // List all positions
  server.get<{
    Querystring: { strategyId?: string; status?: 'open' | 'closed' };
  }>('/', async (request, reply) => {
    const { strategyId, status } = request.query;

    let positions;
    if (status === 'open') {
      positions = await positionManager.getOpenPositions(strategyId);
    } else {
      positions = await positionManager.getAllPositions(strategyId);
    }

    const totalPnL = positionManager.getTotalPnL(strategyId);

    return {
      success: true,
      positions,
      total: positions.length,
      totalPnL,
    };
  });

  // Get position details
  server.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const position = await positionManager.getPosition(id);

    if (!position) {
      return reply.status(404).send({
        success: false,
        error: 'Position not found',
      });
    }

    return {
      success: true,
      position,
    };
  });

  // Close position manually
  server.post<{ Params: { id: string }; Body: { price?: number } }>(
    '/:id/close',
    async (request, reply) => {
      const { id } = request.params;
      const { price } = request.body;

      const position = await positionManager.getPosition(id);

      if (!position) {
        return reply.status(404).send({
          success: false,
          error: 'Position not found',
        });
      }

      const exitPrice = price || position.currentPrice;
      const closedPosition = await positionManager.closePosition(id, exitPrice);

      return {
        success: true,
        position: closedPosition,
        message: 'Position closed',
      };
    }
  );

  // Get position statistics
  server.get('/stats', async (request, reply) => {
    const stats = positionManager.getStats();

    return {
      success: true,
      stats,
    };
  });
}
