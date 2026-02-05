/**
 * Base Strategy Class
 * All trading strategies extend this class
 */

import { EventEmitter } from 'events';
import type {
  IStrategy,
  StrategyConfig,
  StrategyState,
  StrategyMetrics,
  RiskParameters,
  Candle,
  Signal,
  Order,
  Position,
  StrategyType,
} from '../../types';

export abstract class BaseStrategy extends EventEmitter implements IStrategy {
  protected state: StrategyState = {};
  protected metrics: StrategyMetrics;

  constructor(public readonly config: StrategyConfig) {
    super();
    this.metrics = this.initializeMetrics();
  }

  get id(): string {
    return this.config.id;
  }

  get name(): string {
    return this.config.name;
  }

  get type(): StrategyType {
    return this.config.type;
  }

  // Lifecycle methods
  async initialize(): Promise<void> {
    this.emit('initialized', { strategyId: this.id });
    this.log('info', 'Strategy initialized', {
      type: this.type,
      symbol: this.config.symbol,
      timeframe: this.config.timeframe,
      mode: this.config.mode,
    });
  }

  async start(): Promise<void> {
    this.config.status = 'active';
    this.config.startedAt = new Date();
    this.emit('started', { strategyId: this.id });
    this.log('info', 'Strategy started');
  }

  async stop(): Promise<void> {
    this.config.status = 'stopped';
    this.config.stoppedAt = new Date();
    this.emit('stopped', { strategyId: this.id });
    this.log('info', 'Strategy stopped');
  }

  async pause(): Promise<void> {
    this.config.status = 'paused';
    this.emit('paused', { strategyId: this.id });
    this.log('info', 'Strategy paused');
  }

  async resume(): Promise<void> {
    this.config.status = 'active';
    this.emit('resumed', { strategyId: this.id });
    this.log('info', 'Strategy resumed');
  }

  // Abstract method - must be implemented by subclasses
  abstract onCandle(candle: Candle): Promise<Signal[]>;

  // Event handlers with default implementations
  async onOrderFilled(order: Order): Promise<void> {
    this.emit('order:filled', { strategyId: this.id, order });
    this.log('info', 'Order filled', {
      orderId: order.id,
      side: order.side,
      quantity: order.filledQuantity,
      price: order.averageFillPrice,
    });
  }

  async onOrderCancelled(order: Order): Promise<void> {
    this.emit('order:cancelled', { strategyId: this.id, order });
    this.log('warn', 'Order cancelled', {
      orderId: order.id,
      side: order.side,
      quantity: order.quantity,
    });
  }

  async onPositionUpdate(position: Position): Promise<void> {
    this.emit('position:update', { strategyId: this.id, position });
    this.log('debug', 'Position updated', {
      positionId: position.id,
      unrealizedPnL: position.unrealizedPnL,
      currentPrice: position.currentPrice,
    });
  }

  async onError(error: Error): Promise<void> {
    this.config.status = 'error';
    this.emit('error', { strategyId: this.id, error });
    this.log('error', 'Strategy error', {
      error: error.message,
      stack: error.stack,
    });
  }

  // State management
  getState(): StrategyState {
    return { ...this.state };
  }

  setState(state: StrategyState): void {
    this.state = { ...this.state, ...state };
    this.emit('state:updated', { strategyId: this.id, state: this.state });
  }

  // Configuration
  getConfig(): StrategyConfig {
    return { ...this.config };
  }

  async updateConfig(updates: Partial<StrategyConfig>): Promise<void> {
    Object.assign(this.config, updates);
    this.config.updatedAt = new Date();
    this.emit('config:updated', { strategyId: this.id, config: this.config });
    this.log('info', 'Configuration updated', { updates });
  }

  // Risk parameters
  getRiskParams(): RiskParameters {
    return { ...this.config.riskParams };
  }

  async updateRiskParams(params: Partial<RiskParameters>): Promise<void> {
    this.config.riskParams = { ...this.config.riskParams, ...params };
    this.config.updatedAt = new Date();
    this.emit('risk:updated', { strategyId: this.id, riskParams: this.config.riskParams });
    this.log('info', 'Risk parameters updated', { params });
  }

  // Metrics
  getMetrics(): StrategyMetrics {
    return { ...this.metrics };
  }

  protected updateMetrics(updates: Partial<StrategyMetrics>): void {
    this.metrics = { ...this.metrics, ...updates };
    this.emit('metrics:updated', { strategyId: this.id, metrics: this.metrics });
  }

  private initializeMetrics(): StrategyMetrics {
    return {
      strategyId: this.id,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnL: 0,
      totalPnLPercent: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      averageTradeDuration: 0,
      currentDrawdown: 0,
      currentDrawdownPercent: 0,
    };
  }

  // Helper methods for subclasses
  protected createSignal(
    type: Signal['type'],
    quantity?: number,
    price?: number,
    stopLoss?: number,
    takeProfit?: number,
    reason?: string
  ): Signal {
    return {
      type,
      symbol: this.config.symbol,
      quantity,
      price,
      stopLoss,
      takeProfit,
      reason,
      metadata: {
        strategyId: this.id,
        strategyType: this.type,
        timestamp: Date.now(),
      },
    };
  }

  protected log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    metadata?: Record<string, any>
  ): void {
    this.emit('log', {
      level,
      message,
      strategyId: this.id,
      strategyName: this.name,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  // Utility methods
  protected isActive(): boolean {
    return this.config.status === 'active';
  }

  protected isPaused(): boolean {
    return this.config.status === 'paused';
  }

  protected isStopped(): boolean {
    return this.config.status === 'stopped';
  }

  protected hasError(): boolean {
    return this.config.status === 'error';
  }
}
