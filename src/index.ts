/**
 * Trading Bot V2 - Main Entry Point
 * 
 * This file initializes all services and starts the application
 */

import { logger } from './utils/logger';
import { appConfig } from './config/app.config';
import { MarketDataService } from './data/market-data.service';
import { PositionManager, positionManager } from './core/position-manager';
import { RiskManager, riskManager } from './core/risk-manager';
import { ExecutionEngine } from './core/execution-engine';
import { StrategyManager } from './core/strategy-manager';
import { OrderSimulator, orderSimulator } from './backtesting/order-simulator';
import { MetricsCalculator, metricsCalculator } from './backtesting/metrics-calculator';
import { BacktestEngine } from './backtesting/backtest-engine';
import { ReportGenerator, reportGenerator } from './backtesting/report-generator';
import { startServer } from './api/server';
import { setStrategyManager } from './api/routes/strategies';
import { setPositionManager } from './api/routes/positions';
import { setBacktestDependencies } from './api/routes/backtest';

async function main() {
  logger.info('='.repeat(80));
  logger.info('Trading Bot V2 - Starting...');
  logger.info('='.repeat(80));

  try {
    // Initialize Market Data Service
    logger.info('Initializing Market Data Service...');
    const marketDataService = new MarketDataService();
    await marketDataService.initialize();
    logger.info('Market Data Service initialized');

    // Initialize Core Engine
    logger.info('Initializing Core Engine...');
    const executionEngine = new ExecutionEngine(marketDataService, riskManager);
    const strategyManager = new StrategyManager(executionEngine, marketDataService);
    logger.info('Core Engine initialized');

    // Initialize Backtesting Engine
    logger.info('Initializing Backtesting Engine...');
    const backtestEngine = new BacktestEngine(
      marketDataService,
      orderSimulator,
      metricsCalculator
    );
    logger.info('Backtesting Engine initialized');

    // Set dependencies for API routes
    setStrategyManager(strategyManager);
    setPositionManager(positionManager);
    setBacktestDependencies(backtestEngine, reportGenerator);

    // Start API Server
    logger.info('Starting API Server...');
    const server = await startServer();

    logger.info('='.repeat(80));
    logger.info('Trading Bot V2 - Ready!');
    logger.info('='.repeat(80));
    logger.info('');
    logger.info('API Server:', {
      url: `http://${appConfig.host}:${appConfig.port}`,
      health: `http://${appConfig.host}:${appConfig.port}/health`,
      docs: 'See README.md for API documentation',
    });

    if (appConfig.wsEnabled) {
      logger.info('WebSocket:', {
        url: `ws://${appConfig.host}:${appConfig.port}/ws`,
      });
    }

    logger.info('');
    logger.info('Features:');
    logger.info('  ✅ Backtesting with real historical data');
    logger.info('  ✅ Paper trading simulation');
    logger.info('  ✅ Live trading on MEXC (when configured)');
    logger.info('  ✅ Multiple parallel strategies (DCA, Grid, Custom)');
    logger.info('  ✅ Comprehensive risk management');
    logger.info('  ✅ Real-time monitoring via WebSocket');
    logger.info('');

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down...');

      // Stop all strategies
      await strategyManager.stopAll();

      // Disconnect from exchanges
      await marketDataService.disconnect();

      // Close server
      await server.close();

      logger.info('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start application', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Start the application
main();

export { main };
