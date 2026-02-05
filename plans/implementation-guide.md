# Implementation Guide - Crypto Trading Bot

## 1. Development Phases

### Phase 1: Foundation (Core Infrastructure)
**Goal**: Set up the project structure and core type system

**Tasks**:
1. Initialize Node.js project with TypeScript
2. Set up development tooling (ESLint, Prettier, Vitest)
3. Create folder structure
4. Define all TypeScript interfaces and types
5. Set up configuration management
6. Implement logging system

**Deliverables**:
- Working TypeScript project
- All type definitions in place
- Configuration system ready
- Logging infrastructure

### Phase 2: Data Layer
**Goal**: Implement market data fetching and caching

**Tasks**:
1. Create exchange provider interface
2. Implement Binance provider for historical data
3. Implement MEXC provider for live trading
4. Build market data service with caching
5. Add data validation and error handling

**Deliverables**:
- Working data providers
- Efficient data caching
- Reliable historical data fetching

### Phase 3: Core Engine
**Goal**: Build the trading engine components

**Tasks**:
1. Implement position manager
2. Build risk manager with all validation logic
3. Create order simulator for backtesting
4. Implement execution engine with mode routing
5. Build strategy manager

**Deliverables**:
- Complete trading engine
- Risk management system
- Order execution system

### Phase 4: Backtesting
**Goal**: Create accurate backtesting system

**Tasks**:
1. Build backtesting engine
2. Implement metrics calculator
3. Create report generator
4. Test with historical data
5. Validate accuracy

**Deliverables**:
- Working backtesting system
- Accurate performance metrics
- Comprehensive reports

### Phase 5: Strategies
**Goal**: Implement trading strategies

**Tasks**:
1. Create base strategy class
2. Implement DCA strategy
3. Implement Grid strategy
4. Create custom strategy template
5. Test all strategies with backtesting

**Deliverables**:
- Working DCA strategy
- Working Grid strategy
- Template for custom strategies

### Phase 6: API Layer
**Goal**: Build REST API and WebSocket server

**Tasks**:
1. Set up Fastify server
2. Implement REST endpoints
3. Add WebSocket support
4. Implement authentication
5. Add rate limiting

**Deliverables**:
- Complete REST API
- Real-time WebSocket updates
- Secure API access

### Phase 7: Database Integration
**Goal**: Add MongoDB for production use

**Tasks**:
1. Set up MongoDB connection
2. Create Mongoose models
3. Implement data persistence
4. Add migration support

**Deliverables**:
- MongoDB integration
- Data persistence
- Production-ready storage

### Phase 8: Testing & Documentation
**Goal**: Ensure quality and usability

**Tasks**:
1. Write unit tests
2. Write integration tests
3. Create comprehensive README
4. Add API documentation
5. Create example configurations

**Deliverables**:
- Test coverage > 80%
- Complete documentation
- Usage examples

### Phase 9: Deployment
**Goal**: Deploy to Railway

**Tasks**:
1. Create Dockerfile
2. Set up Railway configuration
3. Configure MongoDB container
4. Deploy and test
5. Set up monitoring

**Deliverables**:
- Deployed application
- Production monitoring
- Deployment documentation

## 2. Code Examples

### 2.1 Base Strategy Implementation

```typescript
// src/strategies/base/base-strategy.ts
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
  Position
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
  
  get type(): string {
    return this.config.type;
  }
  
  // Lifecycle methods
  async initialize(): Promise<void> {
    this.emit('initialized', { strategyId: this.id });
  }
  
  async start(): Promise<void> {
    this.config.status = 'active';
    this.config.startedAt = new Date();
    this.emit('started', { strategyId: this.id });
  }
  
  async stop(): Promise<void> {
    this.config.status = 'stopped';
    this.config.stoppedAt = new Date();
    this.emit('stopped', { strategyId: this.id });
  }
  
  async pause(): Promise<void> {
    this.config.status = 'paused';
    this.emit('paused', { strategyId: this.id });
  }
  
  async resume(): Promise<void> {
    this.config.status = 'active';
    this.emit('resumed', { strategyId: this.id });
  }
  
  // Abstract methods - must be implemented by subclasses
  abstract onCandle(candle: Candle): Promise<Signal[]>;
  
  // Event handlers with default implementations
  async onOrderFilled(order: Order): Promise<void> {
    this.emit('order:filled', { strategyId: this.id, order });
  }
  
  async onOrderCancelled(order: Order): Promise<void> {
    this.emit('order:cancelled', { strategyId: this.id, order });
  }
  
  async onPositionUpdate(position: Position): Promise<void> {
    this.emit('position:update', { strategyId: this.id, position });
  }
  
  async onError(error: Error): Promise<void> {
    this.config.status = 'error';
    this.emit('error', { strategyId: this.id, error });
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
  }
  
  // Risk parameters
  getRiskParams(): RiskParameters {
    return { ...this.config.riskParams };
  }
  
  async updateRiskParams(params: Partial<RiskParameters>): Promise<void> {
    this.config.riskParams = { ...this.config.riskParams, ...params };
    this.config.updatedAt = new Date();
    this.emit('risk:updated', { strategyId: this.id, riskParams: this.config.riskParams });
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
      currentDrawdownPercent: 0
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
        timestamp: Date.now()
      }
    };
  }
  
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: any): void {
    this.emit('log', {
      level,
      message,
      strategyId: this.id,
      strategyName: this.name,
      ...metadata
    });
  }
}
```

### 2.2 DCA Strategy Implementation

```typescript
// src/strategies/dca/dca-strategy.ts
import { BaseStrategy } from '../base/base-strategy';
import type { Candle, Signal } from '../../types';

interface DCAState {
  lastInvestmentTime: number;
  totalInvested: number;
  averageEntryPrice: number;
  investmentCount: number;
  averageDownCount: number;
}

export class DCAStrategy extends BaseStrategy {
  private dcaState: DCAState = {
    lastInvestmentTime: 0,
    totalInvested: 0,
    averageEntryPrice: 0,
    investmentCount: 0,
    averageDownCount: 0
  };
  
  async initialize(): Promise<void> {
    await super.initialize();
    
    // Load state if resuming
    const savedState = this.getState();
    if (savedState.customState?.dca) {
      this.dcaState = savedState.customState.dca;
    }
    
    this.log('info', 'DCA Strategy initialized', {
      symbol: this.config.symbol,
      investmentAmount: this.config.parameters.investmentAmount,
      interval: this.config.parameters.interval
    });
  }
  
  async onCandle(candle: Candle): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    // Check if it's time to invest
    if (this.shouldInvest(candle.timestamp)) {
      const buySignal = this.createBuySignal(candle);
      if (buySignal) {
        signals.push(buySignal);
      }
    }
    
    // Check for average down opportunity
    if (this.shouldAverageDown(candle.close)) {
      const averageDownSignal = this.createAverageDownSignal(candle);
      if (averageDownSignal) {
        signals.push(averageDownSignal);
      }
    }
    
    // Check for take profit
    if (this.shouldTakeProfit(candle.close)) {
      const sellSignal = this.createSellSignal(candle);
      if (sellSignal) {
        signals.push(sellSignal);
      }
    }
    
    // Update state
    this.setState({
      lastProcessedCandle: candle.timestamp,
      customState: { dca: this.dcaState }
    });
    
    return signals;
  }
  
  private shouldInvest(timestamp: number): boolean {
    const { interval } = this.config.parameters;
    
    if (this.dcaState.lastInvestmentTime === 0) {
      return true; // First investment
    }
    
    const timeSinceLastInvestment = timestamp - this.dcaState.lastInvestmentTime;
    const intervalMs = this.getIntervalMs(interval);
    
    return timeSinceLastInvestment >= intervalMs;
  }
  
  private shouldAverageDown(currentPrice: number): boolean {
    const { averageDown, averageDownPercent, maxAverageDowns } = this.config.parameters;
    
    if (!averageDown || this.dcaState.averageEntryPrice === 0) {
      return false;
    }
    
    if (this.dcaState.averageDownCount >= (maxAverageDowns || 0)) {
      return false;
    }
    
    const priceDropPercent = ((this.dcaState.averageEntryPrice - currentPrice) / this.dcaState.averageEntryPrice) * 100;
    
    return priceDropPercent >= (averageDownPercent || 0);
  }
  
  private shouldTakeProfit(currentPrice: number): boolean {
    const { takeProfitPercent } = this.config.parameters;
    
    if (!takeProfitPercent || this.dcaState.averageEntryPrice === 0) {
      return false;
    }
    
    const profitPercent = ((currentPrice - this.dcaState.averageEntryPrice) / this.dcaState.averageEntryPrice) * 100;
    
    return profitPercent >= takeProfitPercent;
  }
  
  private createBuySignal(candle: Candle): Signal | null {
    const { investmentAmount } = this.config.parameters;
    const quantity = investmentAmount / candle.close;
    
    // Update state
    this.dcaState.lastInvestmentTime = candle.timestamp;
    this.dcaState.totalInvested += investmentAmount;
    this.dcaState.investmentCount++;
    
    // Calculate new average entry price
    const totalQuantity = this.dcaState.averageEntryPrice > 0
      ? (this.dcaState.totalInvested - investmentAmount) / this.dcaState.averageEntryPrice + quantity
      : quantity;
    this.dcaState.averageEntryPrice = this.dcaState.totalInvested / totalQuantity;
    
    const stopLoss = this.config.riskParams.stopLossPercent
      ? candle.close * (1 - this.config.riskParams.stopLossPercent / 100)
      : undefined;
    
    const takeProfit = this.config.parameters.takeProfitPercent
      ? this.dcaState.averageEntryPrice * (1 + this.config.parameters.takeProfitPercent / 100)
      : undefined;
    
    return this.createSignal(
      'buy',
      quantity,
      undefined, // Market order
      stopLoss,
      takeProfit,
      `Regular DCA investment #${this.dcaState.investmentCount}`
    );
  }
  
  private createAverageDownSignal(candle: Candle): Signal | null {
    const { investmentAmount } = this.config.parameters;
    const quantity = investmentAmount / candle.close;
    
    // Update state
    this.dcaState.totalInvested += investmentAmount;
    this.dcaState.averageDownCount++;
    
    // Recalculate average entry price
    const totalQuantity = (this.dcaState.totalInvested - investmentAmount) / this.dcaState.averageEntryPrice + quantity;
    this.dcaState.averageEntryPrice = this.dcaState.totalInvested / totalQuantity;
    
    return this.createSignal(
      'buy',
      quantity,
      undefined,
      undefined,
      undefined,
      `Average down #${this.dcaState.averageDownCount} at ${candle.close}`
    );
  }
  
  private createSellSignal(candle: Candle): Signal | null {
    // Sell entire position
    const totalQuantity = this.dcaState.totalInvested / this.dcaState.averageEntryPrice;
    
    // Reset state after taking profit
    this.dcaState = {
      lastInvestmentTime: candle.timestamp,
      totalInvested: 0,
      averageEntryPrice: 0,
      investmentCount: 0,
      averageDownCount: 0
    };
    
    return this.createSignal(
      'sell',
      totalQuantity,
      undefined,
      undefined,
      undefined,
      `Take profit at ${candle.close}`
    );
  }
  
  private getIntervalMs(interval: string | number): number {
    if (typeof interval === 'number') {
      return interval;
    }
    
    const intervals: Record<string, number> = {
      'hourly': 60 * 60 * 1000,
      'daily': 24 * 60 * 60 * 1000,
      'weekly': 7 * 24 * 60 * 60 * 1000,
      'monthly': 30 * 24 * 60 * 60 * 1000
    };
    
    return intervals[interval] || intervals['daily'];
  }
}
```

### 2.3 Grid Strategy Implementation

```typescript
// src/strategies/grid/grid-strategy.ts
import { BaseStrategy } from '../base/base-strategy';
import type { Candle, Signal, Order } from '../../types';

interface GridLevel {
  price: number;
  quantity: number;
  hasOrder: boolean;
  orderId?: string;
}

interface GridState {
  grids: GridLevel[];
  initialized: boolean;
}

export class GridStrategy extends BaseStrategy {
  private gridState: GridState = {
    grids: [],
    initialized: false
  };
  
  async initialize(): Promise<void> {
    await super.initialize();
    
    const { gridLevels, upperPrice, lowerPrice, quantityPerGrid } = this.config.parameters;
    
    // Calculate grid levels
    const priceStep = (upperPrice - lowerPrice) / (gridLevels - 1);
    
    for (let i = 0; i < gridLevels; i++) {
      const price = lowerPrice + (priceStep * i);
      this.gridState.grids.push({
        price,
        quantity: quantityPerGrid,
        hasOrder: false
      });
    }
    
    this.gridState.initialized = true;
    
    this.log('info', 'Grid Strategy initialized', {
      symbol: this.config.symbol,
      gridLevels,
      upperPrice,
      lowerPrice,
      priceStep
    });
  }
  
  async onCandle(candle: Candle): Promise<Signal[]> {
    if (!this.gridState.initialized) {
      return [];
    }
    
    const signals: Signal[] = [];
    const currentPrice = candle.close;
    
    // Check each grid level
    for (let i = 0; i < this.gridState.grids.length; i++) {
      const grid = this.gridState.grids[i];
      
      // Buy at lower grids when price drops
      if (i < this.gridState.grids.length - 1) {
        const nextGrid = this.gridState.grids[i + 1];
        
        if (currentPrice <= grid.price && !grid.hasOrder) {
          // Place buy order at this grid
          const buySignal = this.createSignal(
            'buy',
            grid.quantity,
            grid.price,
            undefined,
            nextGrid.price, // Take profit at next grid
            `Grid buy at level ${i + 1}`
          );
          signals.push(buySignal);
          grid.hasOrder = true;
        }
      }
      
      // Sell at upper grids when price rises
      if (i > 0) {
        const prevGrid = this.gridState.grids[i - 1];
        
        if (currentPrice >= grid.price && prevGrid.hasOrder) {
          // Place sell order at this grid
          const sellSignal = this.createSignal(
            'sell',
            grid.quantity,
            grid.price,
            undefined,
            undefined,
            `Grid sell at level ${i + 1}`
          );
          signals.push(sellSignal);
        }
      }
    }
    
    // Update state
    this.setState({
      lastProcessedCandle: candle.timestamp,
      customState: { grid: this.gridState }
    });
    
    return signals;
  }
  
  async onOrderFilled(order: Order): Promise<void> {
    await super.onOrderFilled(order);
    
    // Update grid state based on filled order
    if (order.side === 'buy') {
      // Mark grid as having position
      const grid = this.findGridByPrice(order.averageFillPrice);
      if (grid) {
        grid.hasOrder = true;
        grid.orderId = order.id;
      }
    } else if (order.side === 'sell') {
      // Mark grid as available again
      const grid = this.findGridByPrice(order.averageFillPrice);
      if (grid) {
        grid.hasOrder = false;
        grid.orderId = undefined;
        
        // Reinvest profits if enabled
        if (this.config.parameters.reinvestProfits) {
          // Logic to reinvest profits
        }
      }
    }
  }
  
  private findGridByPrice(price: number): GridLevel | undefined {
    const tolerance = 0.01; // 1% tolerance
    return this.gridState.grids.find(grid => 
      Math.abs(grid.price - price) / grid.price < tolerance
    );
  }
}
```

### 2.4 Backtesting Engine Implementation

```typescript
// src/backtesting/backtest-engine.ts
import type {
  IBacktestEngine,
  BacktestConfig,
  BacktestResult,
  BacktestProgress,
  IStrategy,
  Candle,
  Order,
  Trade,
  EquityPoint
} from '../types';
import { OrderSimulator } from './order-simulator';
import { MetricsCalculator } from './metrics-calculator';

export class BacktestEngine implements IBacktestEngine {
  private isRunning = false;
  private isPaused = false;
  private shouldStop = false;
  private progress: BacktestProgress = {
    currentTimestamp: 0,
    totalCandles: 0,
    processedCandles: 0,
    percentComplete: 0,
    estimatedTimeRemaining: 0
  };
  
  constructor(
    private marketDataService: any,
    private orderSimulator: OrderSimulator,
    private metricsCalculator: MetricsCalculator
  ) {}
  
  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    this.isRunning = true;
    this.shouldStop = false;
    
    const startTime = Date.now();
    
    // Fetch historical data
    const candles = await this.marketDataService.getHistoricalCandles(
      config.symbol,
      config.timeframe,
      config.startTime,
      config.endTime,
      'binance' // Use Binance for backtesting
    );
    
    this.progress.totalCandles = candles.length;
    
    // Initialize strategy
    const strategy = this.createStrategy(config.strategy);
    await strategy.initialize();
    await strategy.start();
    
    // Tracking
    const trades: Trade[] = [];
    const equity: EquityPoint[] = [];
    const openOrders: Order[] = [];
    let currentCapital = config.initialCapital;
    
    equity.push({
      timestamp: config.startTime,
      equity: currentCapital
    });
    
    // Process each candle
    for (let i = 0; i < candles.length; i++) {
      if (this.shouldStop) break;
      
      while (this.isPaused) {
        await this.sleep(100);
      }
      
      const candle = candles[i];
      this.progress.currentTimestamp = candle.timestamp;
      this.progress.processedCandles = i + 1;
      this.progress.percentComplete = ((i + 1) / candles.length) * 100;
      
      // Check and fill open orders
      for (const order of [...openOrders]) {
        const fill = this.orderSimulator.simulateFill(order, candle, config);
        
        if (fill) {
          // Order filled
          order.status = 'filled';
          order.filledQuantity = fill.quantity;
          order.averageFillPrice = fill.price;
          order.fee = fill.fee;
          order.filledAt = new Date(candle.timestamp);
          
          // Create trade record
          const trade: Trade = {
            id: `trade-${Date.now()}-${Math.random()}`,
            strategyId: strategy.id,
            orderId: order.id,
            symbol: order.symbol,
            side: order.side,
            quantity: fill.quantity,
            price: fill.price,
            fee: fill.fee,
            feeAsset: fill.feeAsset,
            timestamp: new Date(candle.timestamp)
          };
          
          trades.push(trade);
          
          // Update capital
          if (order.side === 'buy') {
            currentCapital -= (fill.quantity * fill.price + fill.fee);
          } else {
            currentCapital += (fill.quantity * fill.price - fill.fee);
          }
          
          // Remove from open orders
          const index = openOrders.indexOf(order);
          if (index > -1) {
            openOrders.splice(index, 1);
          }
          
          // Notify strategy
          await strategy.onOrderFilled(order);
        }
      }
      
      // Get signals from strategy
      const signals = await strategy.onCandle(candle);
      
      // Process signals
      for (const signal of signals) {
        if (signal.type === 'buy' || signal.type === 'sell') {
          const order: Order = {
            id: `order-${Date.now()}-${Math.random()}`,
            strategyId: strategy.id,
            symbol: signal.symbol,
            side: signal.type === 'buy' ? 'buy' : 'sell',
            type: signal.price ? 'limit' : 'market',
            quantity: signal.quantity || 0,
            price: signal.price,
            status: 'pending',
            filledQuantity: 0,
            averageFillPrice: 0,
            fee: 0,
            feeAsset: 'USDT',
            createdAt: new Date(candle.timestamp),
            updatedAt: new Date(candle.timestamp)
          };
          
          openOrders.push(order);
        }
      }
      
      // Record equity
      equity.push({
        timestamp: candle.timestamp,
        equity: currentCapital
      });
    }
    
    // Stop strategy
    await strategy.stop();
    
    // Calculate metrics
    const metrics = this.metricsCalculator.calculateMetrics(
      trades,
      equity,
      config.initialCapital
    );
    
    const duration = Date.now() - startTime;
    
    this.isRunning = false;
    
    return {
      config,
      metrics,
      trades,
      equity,
      drawdown: this.calculateDrawdownPoints(equity),
      duration,
      candlesProcessed: this.progress.processedCandles
    };
  }
  
  pauseBacktest(): void {
    this.isPaused = true;
  }
  
  resumeBacktest(): void {
    this.isPaused = false;
  }
  
  stopBacktest(): void {
    this.shouldStop = true;
  }
  
  getProgress(): BacktestProgress {
    return { ...this.progress };
  }
  
  private createStrategy(config: any): IStrategy {
    // Factory method to create strategy based on type
    // Implementation depends on strategy registry
    throw new Error('Not implemented');
  }
  
  private calculateDrawdownPoints(equity: EquityPoint[]): any[] {
    const drawdown: any[] = [];
    let peak = equity[0]?.equity || 0;
    
    for (const point of equity) {
      if (point.equity > peak) {
        peak = point.equity;
      }
      
      const dd = peak - point.equity;
      const ddPercent = (dd / peak) * 100;
      
      drawdown.push({
        timestamp: point.timestamp,
        drawdown: dd,
        drawdownPercent: ddPercent
      });
    }
    
    return drawdown;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## 3. Best Practices

### 3.1 Error Handling

```typescript
// Always wrap exchange calls in try-catch
async function fetchCandles(symbol: string): Promise<Candle[]> {
  try {
    const candles = await exchangeProvider.getCandles(symbol, '15m');
    return candles;
  } catch (error) {
    if (error instanceof ExchangeError) {
      logger.error('Exchange error', { symbol, error: error.message });
      // Retry logic or fallback
    }
    throw error;
  }
}

// Use custom error types
class InsufficientBalanceError extends TradingBotError {
  constructor(required: number, available: number) {
    super(
      `Insufficient balance: required ${required}, available ${available}`,
      'INSUFFICIENT_BALANCE',
      400
    );
  }
}
```

### 3.2 Logging

```typescript
// Structured logging
logger.info('Order executed', {
  strategyId: 'dca-btc-001',
  orderId: 'order-123',
  symbol: 'BTC/USDT',
  side: 'buy',
  quantity: 0.001,
  price: 45000,
  fee: 0.045
});

// Log levels
logger.debug('Processing candle', { timestamp: candle.timestamp });
logger.info('Strategy started', { strategyId });
logger.warn('Risk limit approaching', { current: 19, max: 20 });
logger.error('Failed to execute order', { error: error.message });
```

### 3.3 Testing

```typescript
// Unit test example
import { describe, it, expect } from 'vitest';
import { DCAStrategy } from '../src/strategies/dca/dca-strategy';

describe('DCAStrategy', () => {
  it('should generate buy signal at regular intervals', async () => {
    const config = createTestConfig({
      parameters: {
        investmentAmount: 100,
        interval: 'daily'
      }
    });
    
    const strategy = new DCAStrategy(config);
    await strategy.initialize();
    
    const candle = createTestCandle({ close: 45000 });
    const signals = await strategy.onCandle(candle);
    
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('buy');
    expect(signals[0].quantity).toBeCloseTo(100 / 45000);
  });
});
```

### 3.4 Configuration Validation

```typescript
// Validate configuration before use
function validateStrategyConfig(config: StrategyConfig): void {
  if (config.riskParams.maxPositionSize <= 0) {
    throw new ValidationError('maxPositionSize must be positive');
  }
  
  if (config.riskParams.stopLossPercent && config.riskParams.stopLossPercent >= 100) {
    throw new ValidationError('stopLossPercent must be less than 100');
  }
  
  if (config.initialCapital <= 0) {
    throw new ValidationError('initialCapital must be positive');
  }
}
```

### 3.5 Performance Optimization

```typescript
// Cache frequently accessed data
class DataCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private ttl = 60000; // 1 minute
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

// Use batch operations
async function fetchMultipleCandles(symbols: string[]): Promise<Map<string, Candle[]>> {
  const promises = symbols.map(symbol => 
    exchangeProvider.getCandles(symbol, '15m')
  );
  
  const results = await Promise.all(promises);
  
  return new Map(symbols.map((symbol, i) => [symbol, results[i]]));
}
```

## 4. Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] API documentation updated
- [ ] Error handling tested
- [ ] Logging configured
- [ ] Rate limiting enabled
- [ ] Security review completed

### Railway Deployment
- [ ] Dockerfile created and tested
- [ ] Railway project created
- [ ] MongoDB container added
- [ ] Environment variables set in Railway
- [ ] Health check endpoint configured
- [ ] Monitoring set up
- [ ] Backup strategy in place

### Post-Deployment
- [ ] Health check passing
- [ ] API endpoints responding
- [ ] WebSocket connections working
- [ ] Database connections stable
- [ ] Logs being collected
- [ ] Metrics being tracked
- [ ] Alerts configured

## 5. Maintenance & Monitoring

### Key Metrics to Monitor
- API response times
- Strategy execution times
- Order fill rates
- Error rates
- Database query performance
- Memory usage
- CPU usage
- Active WebSocket connections

### Regular Tasks
- Review logs for errors
- Check strategy performance
- Monitor risk limits
- Update dependencies
- Backup database
- Review and optimize queries
- Test disaster recovery

### Alerts to Configure
- High error rate
- Risk limit breaches
- Database connection failures
- Exchange API failures
- Unusual trading activity
- System resource exhaustion

This implementation guide provides practical examples and best practices for building the crypto trading bot. Follow these patterns to ensure a robust, maintainable, and performant system.
