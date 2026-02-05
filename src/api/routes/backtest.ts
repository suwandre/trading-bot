/**
 * Backtesting Routes
 */

import type { FastifyInstance } from 'fastify';
import type { BacktestConfig } from '../../types';
import { BacktestEngine } from '../../backtesting/backtest-engine';
import { ReportGenerator } from '../../backtesting/report-generator';

let backtestEngine: BacktestEngine;
let reportGenerator: ReportGenerator;

export function setBacktestDependencies(engine: BacktestEngine, generator: ReportGenerator) {
  backtestEngine = engine;
  reportGenerator = generator;
}

export async function backtestRoutes(server: FastifyInstance) {
  // Run a backtest
  server.post<{ Body: BacktestConfig }>('/', async (request, reply) => {
    const config = request.body;

    const result = await backtestEngine.runBacktest(config);

    return {
      success: true,
      result,
    };
  });

  // Get backtest progress
  server.get('/progress', async (request, reply) => {
    if (!backtestEngine.isBacktestRunning()) {
      return reply.status(404).send({
        success: false,
        error: 'No backtest is currently running',
      });
    }

    const progress = backtestEngine.getProgress();

    return {
      success: true,
      progress,
    };
  });

  // Pause backtest
  server.post('/pause', async (request, reply) => {
    backtestEngine.pauseBacktest();

    return {
      success: true,
      message: 'Backtest paused',
    };
  });

  // Resume backtest
  server.post('/resume', async (request, reply) => {
    backtestEngine.resumeBacktest();

    return {
      success: true,
      message: 'Backtest resumed',
    };
  });

  // Stop backtest
  server.post('/stop', async (request, reply) => {
    backtestEngine.stopBacktest();

    return {
      success: true,
      message: 'Backtest stopped',
    };
  });
}
