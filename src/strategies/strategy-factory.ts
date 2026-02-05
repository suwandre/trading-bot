/**
 * Strategy Factory
 * Creates strategy instances based on configuration
 */

import type { IStrategy, StrategyConfig, StrategyType } from '../types';
import { DCAStrategy } from './dca/dca-strategy';
import { GridStrategy } from './grid/grid-strategy';
import { CustomStrategyTemplate } from './custom/custom-strategy-template';
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
        return new GridStrategy(config);

      case 'custom':
        return new CustomStrategyTemplate(config);

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

    if (!params.gridLevels || params.gridLevels < 2) {
      errors.push('Grid: Grid levels must be at least 2');
    }

    if (!params.upperPrice || params.upperPrice <= 0) {
      errors.push('Grid: Upper price must be positive');
    }

    if (!params.lowerPrice || params.lowerPrice <= 0) {
      errors.push('Grid: Lower price must be positive');
    }

    if (params.upperPrice && params.lowerPrice && params.upperPrice <= params.lowerPrice) {
      errors.push('Grid: Upper price must be greater than lower price');
    }

    if (!params.quantityPerGrid || params.quantityPerGrid <= 0) {
      errors.push('Grid: Quantity per grid must be positive');
    }

    if (!params.gridSpacingPercent || params.gridSpacingPercent <= 0) {
      errors.push('Grid: Grid spacing percent must be positive');
    }

    return errors;
  }

  /**
   * Get available strategy types
   */
  static getAvailableTypes(): StrategyType[] {
    return ['dca', 'grid', 'custom'];
  }

  /**
   * Get strategy type description
   */
  static getStrategyDescription(type: StrategyType): string {
    const descriptions: Record<StrategyType, string> = {
      dca: 'Dollar Cost Averaging - Invest fixed amounts at regular intervals',
      grid: 'Grid Trading - Place buy/sell orders at predefined price levels',
      custom: 'Custom Strategy - Implement your own trading logic',
    };

    return descriptions[type];
  }
}
