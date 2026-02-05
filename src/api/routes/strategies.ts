/**
 * Strategy Management Routes
 */

import type { FastifyInstance } from 'fastify';
import type { StrategyConfig } from '../../types';
import { StrategyManager } from '../../core/strategy-manager';
import { ValidationError } from '../../utils/errors';

// This will be injected from the main app
let strategyManager: StrategyManager;

export function setStrategyManager(manager: StrategyManager) {
  strategyManager = manager;
}

export async function strategyRoutes(server: FastifyInstance) {
  // Create a new strategy
  server.post<{ Body: StrategyConfig }>('/', async (request, reply) => {
    const config = request.body;

    try {
      const strategy = await strategyManager.registerStrategy(config);
      return {
        success: true,
        strategy: strategy.getConfig(),
      };
    } catch (error) {
      throw error;
    }
  });

  // List all strategies
  server.get('/', async (request, reply) => {
    const strategies = strategyManager.getAllStrategies();

    return {
      success: true,
      strategies: strategies.map((s) => s.getConfig()),
      total: strategies.length,
    };
  });

  // Get strategy details
  server.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const strategy = strategyManager.getStrategy(id);

    if (!strategy) {
      return reply.status(404).send({
        success: false,
        error: 'Strategy not found',
      });
    }

    return {
      success: true,
      strategy: strategy.getConfig(),
      metrics: strategy.getMetrics(),
      state: strategy.getState(),
    };
  });

  // Update strategy
  server.patch<{ Params: { id: string }; Body: Partial<StrategyConfig> }>(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      try {
        await strategyManager.updateStrategyConfig(id, updates);
        const strategy = strategyManager.getStrategy(id);

        return {
          success: true,
          strategy: strategy?.getConfig(),
        };
      } catch (error) {
        throw error;
      }
    }
  );

  // Delete strategy
  server.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      await strategyManager.unregisterStrategy(id);

      return {
        success: true,
        message: `Strategy ${id} deleted`,
      };
    } catch (error) {
      throw error;
    }
  });

  // Start strategy
  server.post<{ Params: { id: string } }>('/:id/start', async (request, reply) => {
    const { id } = request.params;

    try {
      await strategyManager.startStrategy(id);
      const strategy = strategyManager.getStrategy(id);

      return {
        success: true,
        strategy: strategy?.getConfig(),
        message: `Strategy ${id} started`,
      };
    } catch (error) {
      throw error;
    }
  });

  // Stop strategy
  server.post<{ Params: { id: string } }>('/:id/stop', async (request, reply) => {
    const { id } = request.params;

    try {
      await strategyManager.stopStrategy(id);
      const strategy = strategyManager.getStrategy(id);

      return {
        success: true,
        strategy: strategy?.getConfig(),
        message: `Strategy ${id} stopped`,
      };
    } catch (error) {
      throw error;
    }
  });

  // Pause strategy
  server.post<{ Params: { id: string } }>('/:id/pause', async (request, reply) => {
    const { id } = request.params;

    try {
      await strategyManager.pauseStrategy(id);
      const strategy = strategyManager.getStrategy(id);

      return {
        success: true,
        strategy: strategy?.getConfig(),
        message: `Strategy ${id} paused`,
      };
    } catch (error) {
      throw error;
    }
  });

  // Resume strategy
  server.post<{ Params: { id: string } }>('/:id/resume', async (request, reply) => {
    const { id } = request.params;

    try {
      await strategyManager.resumeStrategy(id);
      const strategy = strategyManager.getStrategy(id);

      return {
        success: true,
        strategy: strategy?.getConfig(),
        message: `Strategy ${id} resumed`,
      };
    } catch (error) {
      throw error;
    }
  });

  // Get strategy metrics
  server.get<{ Params: { id: string } }>('/:id/metrics', async (request, reply) => {
    const { id } = request.params;

    try {
      const metrics = strategyManager.getStrategyMetrics(id);

      return {
        success: true,
        metrics,
      };
    } catch (error) {
      throw error;
    }
  });

  // Get all metrics
  server.get('/metrics/all', async (request, reply) => {
    const metrics = strategyManager.getAllMetrics();

    return {
      success: true,
      metrics,
    };
  });
}
