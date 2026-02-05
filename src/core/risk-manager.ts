/**
 * Risk Manager
 * Validates trades and enforces risk limits
 */

import type { Signal, IStrategy, Position, Order, RiskParameters } from '../types';
import { PositionManager, positionManager } from './position-manager';
import { RiskLimitError, ValidationError } from '../utils/errors';
import { createLogger } from '../utils/logger';
import { appConfig } from '../config/app.config';

const logger = createLogger('RiskManager');

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  adjustedQuantity?: number;
}

export class RiskManager {
  private dailyLoss: number = 0;
  private dailyLossResetTime: number = Date.now();
  private emergencyStopActive: boolean = false;

  constructor(private positionManager: PositionManager) {
    logger.info('Risk Manager initialized', {
      maxTotalExposure: appConfig.maxTotalExposure,
      maxDailyLoss: appConfig.maxDailyLoss,
      maxDrawdownPercent: appConfig.maxDrawdownPercent,
    });
  }

  /**
   * Validate a trading signal before execution
   */
  async validateSignal(signal: Signal, strategy: IStrategy): Promise<ValidationResult> {
    // Check if emergency stop is active
    if (this.emergencyStopActive) {
      return {
        valid: false,
        reason: 'Emergency stop is active',
      };
    }

    // Check if strategy is active
    if (strategy.config.status !== 'active') {
      return {
        valid: false,
        reason: `Strategy ${strategy.id} is not active`,
      };
    }

    // Validate signal type
    if (signal.type === 'hold') {
      return { valid: true };
    }

    // For buy/sell signals, validate quantity
    if (!signal.quantity || signal.quantity <= 0) {
      return {
        valid: false,
        reason: 'Invalid quantity',
      };
    }

    // Validate based on signal type
    if (signal.type === 'buy') {
      return await this.validateBuySignal(signal, strategy);
    } else if (signal.type === 'sell' || signal.type === 'close_long' || signal.type === 'close_short') {
      return await this.validateSellSignal(signal, strategy);
    }

    return { valid: true };
  }

  /**
   * Validate buy signal
   */
  private async validateBuySignal(signal: Signal, strategy: IStrategy): Promise<ValidationResult> {
    const riskParams = strategy.getRiskParams();
    const currentPrice = signal.price || 0; // Should be provided

    if (currentPrice <= 0) {
      return {
        valid: false,
        reason: 'Invalid price',
      };
    }

    // Calculate position size
    const positionSize = signal.quantity! * currentPrice;

    // Check max position size
    if (positionSize > riskParams.maxPositionSize) {
      const adjustedQuantity = riskParams.maxPositionSize / currentPrice;
      logger.warn('Position size exceeds limit, adjusting', {
        strategyId: strategy.id,
        requestedSize: positionSize,
        maxSize: riskParams.maxPositionSize,
        adjustedQuantity,
      });

      return {
        valid: true,
        adjustedQuantity,
      };
    }

    // Check max open positions
    const openPositions = await this.positionManager.getOpenPositions(strategy.id);
    if (openPositions.length >= riskParams.maxOpenPositions) {
      return {
        valid: false,
        reason: `Maximum open positions (${riskParams.maxOpenPositions}) reached`,
      };
    }

    // Check global exposure
    const totalExposure = this.positionManager.getTotalExposure();
    if (totalExposure + positionSize > appConfig.maxTotalExposure) {
      return {
        valid: false,
        reason: `Global exposure limit (${appConfig.maxTotalExposure}) would be exceeded`,
      };
    }

    // Check daily loss limit
    if (!this.checkDailyLoss()) {
      return {
        valid: false,
        reason: `Daily loss limit (${appConfig.maxDailyLoss}) reached`,
      };
    }

    // Check drawdown
    const metrics = strategy.getMetrics();
    if (metrics.currentDrawdownPercent > riskParams.maxDrawdownPercent) {
      return {
        valid: false,
        reason: `Strategy drawdown (${metrics.currentDrawdownPercent.toFixed(2)}%) exceeds limit (${riskParams.maxDrawdownPercent}%)`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate sell signal
   */
  private async validateSellSignal(signal: Signal, strategy: IStrategy): Promise<ValidationResult> {
    // For sell signals, we mainly check if there are positions to close
    const openPositions = await this.positionManager.getOpenPositions(strategy.id);

    if (openPositions.length === 0) {
      return {
        valid: false,
        reason: 'No open positions to close',
      };
    }

    return { valid: true };
  }

  /**
   * Check stop-loss for a position
   */
  checkStopLoss(position: Position, currentPrice: number): boolean {
    if (!position.stopLoss) {
      return false;
    }

    if (position.side === 'long') {
      return currentPrice <= position.stopLoss;
    } else {
      return currentPrice >= position.stopLoss;
    }
  }

  /**
   * Check take-profit for a position
   */
  checkTakeProfit(position: Position, currentPrice: number): boolean {
    if (!position.takeProfit) {
      return false;
    }

    if (position.side === 'long') {
      return currentPrice >= position.takeProfit;
    } else {
      return currentPrice <= position.takeProfit;
    }
  }

  /**
   * Check drawdown for a strategy
   */
  checkDrawdown(strategy: IStrategy): boolean {
    const metrics = strategy.getMetrics();
    const riskParams = strategy.getRiskParams();

    return metrics.currentDrawdownPercent <= riskParams.maxDrawdownPercent;
  }

  /**
   * Check global exposure
   */
  checkGlobalExposure(newPositionSize: number): boolean {
    const totalExposure = this.positionManager.getTotalExposure();
    return totalExposure + newPositionSize <= appConfig.maxTotalExposure;
  }

  /**
   * Check daily loss limit
   */
  checkDailyLoss(): boolean {
    // Reset daily loss if it's a new day
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (now - this.dailyLossResetTime > oneDayMs) {
      this.dailyLoss = 0;
      this.dailyLossResetTime = now;
      logger.info('Daily loss counter reset');
    }

    return Math.abs(this.dailyLoss) < appConfig.maxDailyLoss;
  }

  /**
   * Record a loss
   */
  recordLoss(amount: number): void {
    this.dailyLoss += amount;
    logger.debug('Loss recorded', {
      amount,
      dailyLoss: this.dailyLoss,
      limit: appConfig.maxDailyLoss,
    });

    // Check if daily loss limit is reached
    if (Math.abs(this.dailyLoss) >= appConfig.maxDailyLoss) {
      logger.error('Daily loss limit reached!', {
        dailyLoss: this.dailyLoss,
        limit: appConfig.maxDailyLoss,
      });

      if (appConfig.emergencyStopEnabled) {
        this.activateEmergencyStop('Daily loss limit reached');
      }
    }
  }

  /**
   * Calculate position size based on risk parameters
   */
  calculatePositionSize(
    signal: Signal,
    strategy: IStrategy,
    currentPrice: number
  ): number {
    const riskParams = strategy.getRiskParams();

    // If position size percent is specified, use it
    if (riskParams.positionSizePercent) {
      const capital = strategy.config.currentCapital;
      const positionValue = capital * (riskParams.positionSizePercent / 100);
      return positionValue / currentPrice;
    }

    // Otherwise, use the signal quantity (already validated)
    return signal.quantity || 0;
  }

  /**
   * Calculate stop-loss price
   */
  calculateStopLoss(
    entryPrice: number,
    side: Position['side'],
    stopLossPercent: number
  ): number {
    if (side === 'long') {
      return entryPrice * (1 - stopLossPercent / 100);
    } else {
      return entryPrice * (1 + stopLossPercent / 100);
    }
  }

  /**
   * Calculate take-profit price
   */
  calculateTakeProfit(
    entryPrice: number,
    side: Position['side'],
    takeProfitPercent: number
  ): number {
    if (side === 'long') {
      return entryPrice * (1 + takeProfitPercent / 100);
    } else {
      return entryPrice * (1 - takeProfitPercent / 100);
    }
  }

  /**
   * Emergency stop all trading
   */
  async emergencyStopAll(): Promise<void> {
    this.activateEmergencyStop('Manual emergency stop');
  }

  /**
   * Emergency stop a specific strategy
   */
  async emergencyStopStrategy(strategyId: string): Promise<void> {
    logger.error('Emergency stop activated for strategy', { strategyId });
    // This would be handled by the strategy manager
  }

  /**
   * Activate emergency stop
   */
  private activateEmergencyStop(reason: string): void {
    this.emergencyStopActive = true;
    logger.error('EMERGENCY STOP ACTIVATED', { reason });

    // In a real implementation, this would:
    // 1. Stop all strategies
    // 2. Close all positions (or at least stop opening new ones)
    // 3. Send alerts
    // 4. Log to database
  }

  /**
   * Deactivate emergency stop
   */
  deactivateEmergencyStop(): void {
    this.emergencyStopActive = false;
    logger.info('Emergency stop deactivated');
  }

  /**
   * Check if emergency stop is active
   */
  isEmergencyStopActive(): boolean {
    return this.emergencyStopActive;
  }

  /**
   * Get risk statistics
   */
  getStats(): {
    dailyLoss: number;
    dailyLossLimit: number;
    dailyLossPercent: number;
    emergencyStopActive: boolean;
    totalExposure: number;
    maxExposure: number;
    exposurePercent: number;
  } {
    const totalExposure = this.positionManager.getTotalExposure();

    return {
      dailyLoss: this.dailyLoss,
      dailyLossLimit: appConfig.maxDailyLoss,
      dailyLossPercent: (Math.abs(this.dailyLoss) / appConfig.maxDailyLoss) * 100,
      emergencyStopActive: this.emergencyStopActive,
      totalExposure,
      maxExposure: appConfig.maxTotalExposure,
      exposurePercent: (totalExposure / appConfig.maxTotalExposure) * 100,
    };
  }

  /**
   * Reset daily loss (for testing)
   */
  resetDailyLoss(): void {
    this.dailyLoss = 0;
    this.dailyLossResetTime = Date.now();
    logger.info('Daily loss manually reset');
  }
}

// Export singleton instance
export const riskManager = new RiskManager(positionManager);
