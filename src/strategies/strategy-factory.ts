/**
 * Strategy Factory
 * Creates strategy instances based on configuration
 */

import type { IStrategy, StrategyConfig, StrategyType } from '../types';
import { DCAStrategy } from './dca/dca-strategy';
import { AdaptiveGridStrategy } from './grid/adaptive-grid-strategy';
import { CustomStrategyTemplate } from './custom/custom-strategy-template';
import { RSIBBStrategy } from './mean-reversion/rsi-bb-strategy';
import { EMAMACDADXStrategy } from './trend/ema-macd-adx-strategy';
import { StrategyError } from '../utils/errors';
import { createLogger } from '../utils/logger';

const logger = createLogger('StrategyFactory');

export class StrategyFactory {
  /**
   * Create a strategy instance from configuration
   */
  static createStrategy(config: StrategyConfig): IStrategy {
    logger.info('Creating strategy', {
      id: config.id,
      type: config.type,
      name: config.name,
    });

    switch (config.type) {
      case 'dca':
        return new DCAStrategy(config);

      case 'grid':
        return new AdaptiveGridStrategy(config);

      case 'custom':
        return new CustomStrategyTemplate(config);

      case 'mean-reversion':
        return new RSIBBStrategy(config);

      case 'trend-following':
        return new EMAMACDADXStrategy(config);

      default:
        throw new StrategyError(
          `Unknown strategy type: ${config.type}`,
          config.id
        );
    }
  }

  /**
   * Validate strategy configuration
   */
  static validateConfig(config: StrategyConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!config.id || config.id.trim() === '') {
      errors.push('Strategy ID is required');
    }

    if (!config.name || config.name.trim() === '') {
      errors.push('Strategy name is required');
    }

    if (!config.symbol || config.symbol.trim() === '') {
      errors.push('Symbol is required');
    }

    if (config.initialCapital <= 0) {
      errors.push('Initial capital must be positive');
    }

    // Risk parameters validation
    if (config.riskParams.maxPositionSize <= 0) {
      errors.push('Max position size must be positive');
    }

    if (config.riskParams.maxOpenPositions <= 0) {
      errors.push('Max open positions must be positive');
    }

    if (config.riskParams.maxDrawdownPercent <= 0 || config.riskParams.maxDrawdownPercent > 100) {
      errors.push('Max drawdown percent must be between 0 and 100');
    }

    if (config.riskParams.stopLossPercent && (config.riskParams.stopLossPercent <= 0 || config.riskParams.stopLossPercent >= 100)) {
      errors.push('Stop loss percent must be between 0 and 100');
    }

    if (config.riskParams.takeProfitPercent && config.riskParams.takeProfitPercent <= 0) {
      errors.push('Take profit percent must be positive');
    }

    // Strategy-specific validation
    errors.push(...this.validateStrategyParams(config));

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate strategy-specific parameters
   */
  private static validateStrategyParams(config: StrategyConfig): string[] {
    const errors: string[] = [];

    switch (config.type) {
      case 'dca':
        errors.push(...this.validateDCAParams(config.parameters));
        break;

      case 'grid':
        errors.push(...this.validateGridParams(config.parameters));
        break;

      case 'custom':
        // Custom strategies can have any parameters
        break;

      case 'mean-reversion':
        // RSI + BB parameters are optional with defaults
        break;

      case 'trend-following':
        // TODO: Add validation when implemented
        break;
    }

    return errors;
  }

  /**
   * Validate DCA strategy parameters
   */
  private static validateDCAParams(params: any): string[] {
    const errors: string[] = [];

    if (!params.investmentAmount || params.investmentAmount <= 0) {
      errors.push('DCA: Investment amount must be positive');
    }

    if (!params.interval) {
      errors.push('DCA: Interval is required');
    }

    if (params.averageDown && !params.averageDownPercent) {
      errors.push('DCA: Average down percent is required when average down is enabled');
    }

    if (params.averageDown && !params.maxAverageDowns) {
      errors.push('DCA: Max average downs is required when average down is enabled');
    }

    return errors;
  }

  /**
   * Validate Grid strategy parameters
   */
  private static validateGridParams(params: any): string[] {
    const errors: string[] = [];

    if (!params.gridLevels || params.gridLevels < 3) {
      errors.push('Grid: Grid levels must be at least 3');
    }

    // For non-adaptive grids, require upper/lower price
    if (params.useAdaptiveGrid === false) {
      if (!params.upperPrice || params.upperPrice <= 0) {
        errors.push('Grid: Upper price must be positive (required for non-adaptive grid)');
      }

      if (!params.lowerPrice || params.lowerPrice <= 0) {
        errors.push('Grid: Lower price must be positive (required for non-adaptive grid)');
      }

      if (params.upperPrice && params.lowerPrice && params.upperPrice <= params.lowerPrice) {
        errors.push('Grid: Upper price must be greater than lower price');
      }
    }

    return errors;
  }

  /**
   * Get available strategy types
   */
  static getAvailableTypes(): StrategyType[] {
    return ['dca', 'grid', 'custom', 'mean-reversion', 'trend-following'];
  }

  /**
   * Get strategy type description
   */
  static getStrategyDescription(type: StrategyType): string {
    const descriptions: Record<StrategyType, string> = {
      dca: 'Smart DCA - Market-aware dollar cost averaging with crash detection and dip buying',
      grid: 'Adaptive Grid Trading - Auto-centering grid with ATR spacing and ADX filter',
      custom: 'Custom Strategy - Implement your own trading logic',
      'mean-reversion': 'Mean Reversion - RSI + Bollinger Bands for oversold bounces',
      'trend-following': 'Trend Following - EMA + MACD + ADX multi-indicator trend strategy',
    };

    return descriptions[type];
  }
}
