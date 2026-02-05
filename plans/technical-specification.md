# Technical Specification - Crypto Trading Bot

## 1. Core Type Definitions

### 1.1 Market Data Types

```typescript
// Timeframe options
type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

// OHLCV Candle
interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Trading pair
interface TradingPair {
  symbol: string;        // e.g., "BTC/USDT"
  base: string;          // e.g., "BTC"
  quote: string;         // e.g., "USDT"
  minOrderSize: number;
  maxOrderSize: number;
  pricePrecision: number;
  quantityPrecision: number;
}

// Market ticker
interface Ticker {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: number;
}
```

### 1.2 Order Types

```typescript
// Order side
type OrderSide = 'buy' | 'sell';

// Order type
type OrderType = 'market' | 'limit' | 'stop_loss' | 'take_profit';

// Order status
type OrderStatus = 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected' | 'expired';

// Order interface
interface Order {
  id: string;
  strategyId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;              // For limit orders
  stopPrice?: number;          // For stop orders
  status: OrderStatus;
  filledQuantity: number;
  averageFillPrice: number;
  fee: number;
  feeAsset: string;
  createdAt: Date;
  updatedAt: Date;
  filledAt?: Date;
  cancelledAt?: Date;
  exchangeOrderId?: string;    // ID from exchange
  clientOrderId?: string;      // Our internal ID
}

// Order fill event
interface OrderFill {
  orderId: string;
  quantity: number;
  price: number;
  fee: number;
  feeAsset: string;
  timestamp: Date;
}
```

### 1.3 Position Types

```typescript
// Position side
type PositionSide = 'long' | 'short';

// Position status
type PositionStatus = 'open' | 'closed';

// Position interface
interface Position {
  id: string;
  strategyId: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalFees: number;
  stopLoss?: number;
  takeProfit?: number;
  status: PositionStatus;
  openedAt: Date;
  closedAt?: Date;
  exitPrice?: number;
  roi?: number;                // Return on investment %
}

// Position update event
interface PositionUpdate {
  positionId: string;
  currentPrice: number;
  unrealizedPnL: number;
  timestamp: Date;
}
```

### 1.4 Trade Types

```typescript
// Trade record (completed transaction)
interface Trade {
  id: string;
  strategyId: string;
  positionId?: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  fee: number;
  feeAsset: string;
  pnl?: number;                // For closing trades
  timestamp: Date;
  exchangeTradeId?: string;
}
```

### 1.5 Strategy Types

```typescript
// Trading mode
type TradingMode = 'backtest' | 'paper' | 'live';

// Strategy type
type StrategyType = 'dca' | 'grid' | 'custom';

// Strategy status
type StrategyStatus = 'active' | 'paused' | 'stopped' | 'error';

// Signal type
type SignalType = 'buy' | 'sell' | 'close_long' | 'close_short' | 'hold';

// Trading signal
interface Signal {
  type: SignalType;
  symbol: string;
  quantity?: number;
  price?: number;              // For limit orders
  stopLoss?: number;
  takeProfit?: number;
  reason?: string;             // Why this signal was generated
  metadata?: Record<string, any>;
}

// Risk parameters
interface RiskParameters {
  stopLossPercent?: number;
  takeProfitPercent?: number;
  trailingStopPercent?: number;
  maxPositionSize: number;     // Max position size in quote currency
  maxOpenPositions: number;    // Max concurrent positions
  maxDrawdownPercent: number;  // Max allowed drawdown
  positionSizePercent?: number; // % of capital per position
}

// Strategy configuration
interface StrategyConfig {
  id: string;
  name: string;
  type: StrategyType;
  symbol: string;
  timeframe: Timeframe;
  mode: TradingMode;
  parameters: Record<string, any>;  // Strategy-specific params
  riskParams: RiskParameters;
  status: StrategyStatus;
  initialCapital: number;
  currentCapital: number;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
}

// Strategy state (runtime state)
interface StrategyState {
  lastProcessedCandle?: number;
  indicators?: Record<string, any>;
  customState?: Record<string, any>;
}

// Strategy performance metrics
interface StrategyMetrics {
  strategyId: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLPercent: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  averageTradeDuration: number;  // in milliseconds
  currentDrawdown: number;
  currentDrawdownPercent: number;
}
```

### 1.6 Strategy Interface

```typescript
interface IStrategy {
  // Metadata
  readonly id: string;
  readonly name: string;
  readonly type: StrategyType;
  readonly config: StrategyConfig;
  
  // Lifecycle methods
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  
  // Event handlers
  onCandle(candle: Candle): Promise<Signal[]>;
  onOrderFilled(order: Order): Promise<void>;
  onOrderCancelled(order: Order): Promise<void>;
  onPositionUpdate(position: Position): Promise<void>;
  onError(error: Error): Promise<void>;
  
  // State management
  getState(): StrategyState;
  setState(state: StrategyState): void;
  
  // Configuration
  getConfig(): StrategyConfig;
  updateConfig(config: Partial<StrategyConfig>): Promise<void>;
  
  // Risk parameters
  getRiskParams(): RiskParameters;
  updateRiskParams(params: Partial<RiskParameters>): Promise<void>;
  
  // Metrics
  getMetrics(): StrategyMetrics;
}
```

## 2. Exchange Provider Interface

```typescript
interface IExchangeProvider {
  readonly name: string;
  
  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // Market data
  getCandles(symbol: string, timeframe: Timeframe, limit?: number, since?: number): Promise<Candle[]>;
  getTicker(symbol: string): Promise<Ticker>;
  getTradingPair(symbol: string): Promise<TradingPair>;
  
  // Orders (live trading only)
  createOrder(order: Omit<Order, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Order>;
  cancelOrder(orderId: string): Promise<void>;
  getOrder(orderId: string): Promise<Order>;
  getOpenOrders(symbol?: string): Promise<Order[]>;
  
  // Account (live trading only)
  getBalance(asset: string): Promise<number>;
  getBalances(): Promise<Record<string, number>>;
  
  // WebSocket streams (optional)
  subscribeTicker(symbol: string, callback: (ticker: Ticker) => void): void;
  subscribeCandles(symbol: string, timeframe: Timeframe, callback: (candle: Candle) => void): void;
  unsubscribe(symbol: string): void;
}
```

## 3. Core Services Specification

### 3.1 Market Data Service

```typescript
interface IMarketDataService {
  // Get historical candles
  getHistoricalCandles(
    symbol: string,
    timeframe: Timeframe,
    startTime: number,
    endTime: number,
    provider?: 'binance' | 'mexc'
  ): Promise<Candle[]>;
  
  // Get latest candle
  getLatestCandle(symbol: string, timeframe: Timeframe): Promise<Candle>;
  
  // Get current price
  getCurrentPrice(symbol: string): Promise<number>;
  
  // Cache management
  clearCache(symbol?: string): void;
  
  // Subscribe to real-time updates
  subscribe(symbol: string, timeframe: Timeframe, callback: (candle: Candle) => void): void;
  unsubscribe(symbol: string, timeframe: Timeframe): void;
}
```

### 3.2 Risk Manager

```typescript
interface IRiskManager {
  // Pre-trade validation
  validateSignal(signal: Signal, strategy: IStrategy): Promise<ValidationResult>;
  validateOrder(order: Order, strategy: IStrategy): Promise<ValidationResult>;
  
  // Position monitoring
  checkStopLoss(position: Position, currentPrice: number): boolean;
  checkTakeProfit(position: Position, currentPrice: number): boolean;
  checkDrawdown(strategy: IStrategy): boolean;
  
  // Global limits
  checkGlobalExposure(newPositionSize: number): boolean;
  checkDailyLoss(): boolean;
  
  // Risk calculations
  calculatePositionSize(
    signal: Signal,
    strategy: IStrategy,
    currentPrice: number
  ): number;
  
  // Emergency controls
  emergencyStopAll(): Promise<void>;
  emergencyStopStrategy(strategyId: string): Promise<void>;
}

interface ValidationResult {
  valid: boolean;
  reason?: string;
  adjustedQuantity?: number;  // If quantity needs adjustment
}
```

### 3.3 Position Manager

```typescript
interface IPositionManager {
  // Position CRUD
  createPosition(position: Omit<Position, 'id' | 'openedAt'>): Promise<Position>;
  getPosition(positionId: string): Promise<Position | null>;
  getPositionsByStrategy(strategyId: string): Promise<Position[]>;
  getOpenPositions(strategyId?: string): Promise<Position[]>;
  updatePosition(positionId: string, updates: Partial<Position>): Promise<Position>;
  closePosition(positionId: string, exitPrice: number): Promise<Position>;
  
  // Position calculations
  calculateUnrealizedPnL(position: Position, currentPrice: number): number;
  calculateRealizedPnL(position: Position, exitPrice: number): number;
  calculateROI(position: Position): number;
  
  // Position monitoring
  updatePositionPrices(currentPrices: Record<string, number>): Promise<void>;
  
  // Aggregations
  getTotalExposure(strategyId?: string): number;
  getTotalPnL(strategyId?: string): number;
}
```

### 3.4 Execution Engine

```typescript
interface IExecutionEngine {
  // Order execution
  executeSignal(signal: Signal, strategy: IStrategy): Promise<Order>;
  executeOrder(order: Order, mode: TradingMode): Promise<Order>;
  cancelOrder(orderId: string): Promise<void>;
  
  // Order tracking
  getOrder(orderId: string): Promise<Order | null>;
  getOrdersByStrategy(strategyId: string): Promise<Order[]>;
  getOpenOrders(strategyId?: string): Promise<Order[]>;
  
  // Mode-specific executors
  backtestExecute(order: Order, candle: Candle): Promise<Order>;
  paperExecute(order: Order): Promise<Order>;
  liveExecute(order: Order): Promise<Order>;
}
```

### 3.5 Strategy Manager

```typescript
interface IStrategyManager {
  // Strategy lifecycle
  registerStrategy(strategy: IStrategy): Promise<void>;
  unregisterStrategy(strategyId: string): Promise<void>;
  startStrategy(strategyId: string): Promise<void>;
  stopStrategy(strategyId: string): Promise<void>;
  pauseStrategy(strategyId: string): Promise<void>;
  resumeStrategy(strategyId: string): Promise<void>;
  
  // Strategy retrieval
  getStrategy(strategyId: string): IStrategy | null;
  getAllStrategies(): IStrategy[];
  getActiveStrategies(): IStrategy[];
  
  // Strategy updates
  updateStrategyConfig(strategyId: string, config: Partial<StrategyConfig>): Promise<void>;
  
  // Event distribution
  distributeCandle(candle: Candle): Promise<void>;
  distributeOrderFill(order: Order): Promise<void>;
  
  // Metrics
  getStrategyMetrics(strategyId: string): StrategyMetrics;
  getAllMetrics(): Record<string, StrategyMetrics>;
}
```

### 3.6 Backtesting Engine

```typescript
interface IBacktestEngine {
  // Run backtest
  runBacktest(config: BacktestConfig): Promise<BacktestResult>;
  
  // Backtest control
  pauseBacktest(): void;
  resumeBacktest(): void;
  stopBacktest(): void;
  
  // Progress tracking
  getProgress(): BacktestProgress;
}

interface BacktestConfig {
  strategy: StrategyConfig;
  symbol: string;
  timeframe: Timeframe;
  startTime: number;
  endTime: number;
  initialCapital: number;
  feeRate: number;           // e.g., 0.001 for 0.1%
  slippagePercent: number;   // e.g., 0.05 for 0.05%
}

interface BacktestResult {
  config: BacktestConfig;
  metrics: StrategyMetrics;
  trades: Trade[];
  equity: EquityPoint[];
  drawdown: DrawdownPoint[];
  duration: number;          // Backtest execution time in ms
  candlesProcessed: number;
}

interface EquityPoint {
  timestamp: number;
  equity: number;
}

interface DrawdownPoint {
  timestamp: number;
  drawdown: number;
  drawdownPercent: number;
}

interface BacktestProgress {
  currentTimestamp: number;
  totalCandles: number;
  processedCandles: number;
  percentComplete: number;
  estimatedTimeRemaining: number;
}
```

## 4. Strategy-Specific Configurations

### 4.1 DCA Strategy

```typescript
interface DCAStrategyParams {
  investmentAmount: number;      // Amount to invest per interval
  interval: 'hourly' | 'daily' | 'weekly' | 'monthly' | number;  // Or custom in ms
  takeProfitPercent?: number;    // Optional take profit
  averageDown?: boolean;         // Buy more when price drops
  averageDownPercent?: number;   // Price drop % to trigger average down
  maxAverageDowns?: number;      // Max number of average downs
}

// Example configuration
const dcaConfig: StrategyConfig = {
  id: 'dca-btc-001',
  name: 'BTC Daily DCA',
  type: 'dca',
  symbol: 'BTC/USDT',
  timeframe: '15m',
  mode: 'paper',
  parameters: {
    investmentAmount: 100,
    interval: 'daily',
    takeProfitPercent: 10,
    averageDown: true,
    averageDownPercent: 5,
    maxAverageDowns: 3
  },
  riskParams: {
    stopLossPercent: 15,
    maxPositionSize: 5000,
    maxOpenPositions: 1,
    maxDrawdownPercent: 20
  },
  status: 'active',
  initialCapital: 10000,
  currentCapital: 10000,
  createdAt: new Date(),
  updatedAt: new Date()
};
```

### 4.2 Grid Strategy

```typescript
interface GridStrategyParams {
  gridLevels: number;            // Number of grid levels
  gridSpacingPercent: number;    // Spacing between grids
  upperPrice: number;            // Upper bound of grid
  lowerPrice: number;            // Lower bound of grid
  quantityPerGrid: number;       // Quantity to trade per grid
  reinvestProfits: boolean;      // Reinvest profits into grid
}

// Example configuration
const gridConfig: StrategyConfig = {
  id: 'grid-eth-001',
  name: 'ETH Grid Trading',
  type: 'grid',
  symbol: 'ETH/USDT',
  timeframe: '5m',
  mode: 'paper',
  parameters: {
    gridLevels: 10,
    gridSpacingPercent: 2,
    upperPrice: 2500,
    lowerPrice: 2000,
    quantityPerGrid: 0.1,
    reinvestProfits: true
  },
  riskParams: {
    maxPositionSize: 10000,
    maxOpenPositions: 10,
    maxDrawdownPercent: 25
  },
  status: 'active',
  initialCapital: 10000,
  currentCapital: 10000,
  createdAt: new Date(),
  updatedAt: new Date()
};
```

### 4.3 Custom Strategy Template

```typescript
interface CustomStrategyParams {
  // Define your own parameters
  [key: string]: any;
}

// Example: Simple Moving Average Crossover
interface SMAStrategyParams extends CustomStrategyParams {
  fastPeriod: number;
  slowPeriod: number;
  positionSizePercent: number;
}

const smaConfig: StrategyConfig = {
  id: 'sma-btc-001',
  name: 'BTC SMA Crossover',
  type: 'custom',
  symbol: 'BTC/USDT',
  timeframe: '15m',
  mode: 'backtest',
  parameters: {
    fastPeriod: 10,
    slowPeriod: 30,
    positionSizePercent: 10
  },
  riskParams: {
    stopLossPercent: 3,
    takeProfitPercent: 6,
    maxPositionSize: 5000,
    maxOpenPositions: 1,
    maxDrawdownPercent: 15
  },
  status: 'active',
  initialCapital: 10000,
  currentCapital: 10000,
  createdAt: new Date(),
  updatedAt: new Date()
};
```

## 5. API Endpoints Specification

### 5.1 Strategy Endpoints

```typescript
// POST /api/strategies - Create a new strategy
interface CreateStrategyRequest {
  name: string;
  type: StrategyType;
  symbol: string;
  timeframe: Timeframe;
  mode: TradingMode;
  parameters: Record<string, any>;
  riskParams: RiskParameters;
  initialCapital: number;
}

interface CreateStrategyResponse {
  strategy: StrategyConfig;
}

// GET /api/strategies - List all strategies
interface ListStrategiesResponse {
  strategies: StrategyConfig[];
  total: number;
}

// GET /api/strategies/:id - Get strategy details
interface GetStrategyResponse {
  strategy: StrategyConfig;
  metrics: StrategyMetrics;
  positions: Position[];
  recentTrades: Trade[];
}

// PATCH /api/strategies/:id - Update strategy
interface UpdateStrategyRequest {
  name?: string;
  parameters?: Record<string, any>;
  riskParams?: Partial<RiskParameters>;
}

interface UpdateStrategyResponse {
  strategy: StrategyConfig;
}

// POST /api/strategies/:id/start - Start strategy
// POST /api/strategies/:id/stop - Stop strategy
// POST /api/strategies/:id/pause - Pause strategy
// POST /api/strategies/:id/resume - Resume strategy
interface StrategyActionResponse {
  strategy: StrategyConfig;
  message: string;
}

// DELETE /api/strategies/:id - Delete strategy
interface DeleteStrategyResponse {
  message: string;
}
```

### 5.2 Position Endpoints

```typescript
// GET /api/positions - List all positions
interface ListPositionsRequest {
  strategyId?: string;
  status?: PositionStatus;
  symbol?: string;
}

interface ListPositionsResponse {
  positions: Position[];
  total: number;
  totalPnL: number;
}

// GET /api/positions/:id - Get position details
interface GetPositionResponse {
  position: Position;
  trades: Trade[];
}

// POST /api/positions/:id/close - Manually close position
interface ClosePositionRequest {
  price?: number;  // Optional manual price
}

interface ClosePositionResponse {
  position: Position;
  message: string;
}
```

### 5.3 Trade Endpoints

```typescript
// GET /api/trades - List all trades
interface ListTradesRequest {
  strategyId?: string;
  symbol?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
}

interface ListTradesResponse {
  trades: Trade[];
  total: number;
  totalPnL: number;
}

// GET /api/trades/:id - Get trade details
interface GetTradeResponse {
  trade: Trade;
}
```

### 5.4 Backtest Endpoints

```typescript
// POST /api/backtest - Run a backtest
interface RunBacktestRequest {
  strategy: StrategyConfig;
  startTime: number;
  endTime: number;
  initialCapital: number;
  feeRate?: number;
  slippagePercent?: number;
}

interface RunBacktestResponse {
  result: BacktestResult;
}

// GET /api/backtest/:id - Get backtest results
interface GetBacktestResponse {
  result: BacktestResult;
}

// GET /api/backtest/:id/progress - Get backtest progress
interface GetBacktestProgressResponse {
  progress: BacktestProgress;
}
```

### 5.5 Health & Metrics Endpoints

```typescript
// GET /api/health - Health check
interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: number;
  uptime: number;
  version: string;
  services: {
    database: 'connected' | 'disconnected';
    binance: 'connected' | 'disconnected';
    mexc: 'connected' | 'disconnected';
  };
}

// GET /api/metrics - Overall metrics
interface MetricsResponse {
  strategies: Record<string, StrategyMetrics>;
  global: {
    totalStrategies: number;
    activeStrategies: number;
    totalPositions: number;
    openPositions: number;
    totalPnL: number;
    totalPnLPercent: number;
    totalTrades: number;
  };
}
```

## 6. WebSocket Events

```typescript
// Client -> Server events
interface WSClientEvents {
  'subscribe:strategy': { strategyId: string };
  'unsubscribe:strategy': { strategyId: string };
  'subscribe:positions': { strategyId?: string };
  'unsubscribe:positions': {};
  'subscribe:trades': { strategyId?: string };
  'unsubscribe:trades': {};
}

// Server -> Client events
interface WSServerEvents {
  'strategy:update': { strategy: StrategyConfig };
  'strategy:metrics': { strategyId: string; metrics: StrategyMetrics };
  'order:created': { order: Order };
  'order:filled': { order: Order };
  'order:cancelled': { order: Order };
  'position:opened': { position: Position };
  'position:updated': { position: Position };
  'position:closed': { position: Position };
  'trade:executed': { trade: Trade };
  'error': { message: string; code?: string };
}
```

## 7. Configuration Files

### 7.1 Environment Variables

```env
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# MongoDB (Optional for backtesting)
MONGODB_URI=mongodb://localhost:27017/trading-bot
MONGODB_ENABLED=false

# Binance API (for historical data)
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
BINANCE_TESTNET=false

# MEXC API (for live trading)
MEXC_API_KEY=your_mexc_api_key
MEXC_API_SECRET=your_mexc_api_secret
MEXC_TESTNET=false

# Risk Management
MAX_TOTAL_EXPOSURE=10000
MAX_DAILY_LOSS=500
MAX_DRAWDOWN_PERCENT=20
EMERGENCY_STOP_ENABLED=true

# Backtesting
BACKTEST_CACHE_ENABLED=true
BACKTEST_CACHE_SIZE=1000

# WebSocket
WS_ENABLED=true
WS_HEARTBEAT_INTERVAL=30000

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

### 7.2 TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

## 8. Key Implementation Notes

### 8.1 Backtesting Order Simulation

```typescript
class OrderSimulator {
  simulateFill(order: Order, candle: Candle, config: BacktestConfig): OrderFill | null {
    // Market orders fill at next candle open
    if (order.type === 'market') {
      const fillPrice = this.applySlippage(candle.open, order.side, config.slippagePercent);
      return this.createFill(order, fillPrice, config.feeRate);
    }
    
    // Limit orders fill if price reaches limit
    if (order.type === 'limit' && order.price) {
      if (order.side === 'buy' && candle.low <= order.price) {
        const fillPrice = order.price;
        return this.createFill(order, fillPrice, config.feeRate);
      }
      if (order.side === 'sell' && candle.high >= order.price) {
        const fillPrice = order.price;
        return this.createFill(order, fillPrice, config.feeRate);
      }
    }
    
    return null;  // Order not filled this candle
  }
  
  private applySlippage(price: number, side: OrderSide, slippagePercent: number): number {
    const slippage = price * (slippagePercent / 100);
    return side === 'buy' ? price + slippage : price - slippage;
  }
  
  private createFill(order: Order, price: number, feeRate: number): OrderFill {
    const fee = order.quantity * price * feeRate;
    return {
      orderId: order.id,
      quantity: order.quantity,
      price,
      fee,
      feeAsset: 'USDT',
      timestamp: new Date()
    };
  }
}
```

### 8.2 Performance Metrics Calculation

```typescript
class MetricsCalculator {
  calculateMetrics(trades: Trade[], equity: EquityPoint[], initialCapital: number): StrategyMetrics {
    const winningTrades = trades.filter(t => t.pnl && t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl && t.pnl < 0);
    
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    
    return {
      strategyId: '',
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: trades.length > 0 ? winningTrades.length / trades.length : 0,
      totalPnL,
      totalPnLPercent: (totalPnL / initialCapital) * 100,
      averageWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
      averageLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
      profitFactor: totalLosses > 0 ? totalWins / totalLosses : 0,
      sharpeRatio: this.calculateSharpeRatio(equity),
      maxDrawdown: this.calculateMaxDrawdown(equity).amount,
      maxDrawdownPercent: this.calculateMaxDrawdown(equity).percent,
      averageTradeDuration: this.calculateAverageDuration(trades),
      currentDrawdown: 0,
      currentDrawdownPercent: 0
    };
  }
  
  private calculateSharpeRatio(equity: EquityPoint[]): number {
    if (equity.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < equity.length; i++) {
      const ret = (equity[i].equity - equity[i-1].equity) / equity[i-1].equity;
      returns.push(ret);
    }
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // Annualized Sharpe (assuming daily returns)
    return stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(365) : 0;
  }
  
  private calculateMaxDrawdown(equity: EquityPoint[]): { amount: number; percent: number } {
    let maxEquity = equity[0]?.equity || 0;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    
    for (const point of equity) {
      if (point.equity > maxEquity) {
        maxEquity = point.equity;
      }
      const drawdown = maxEquity - point.equity;
      const drawdownPercent = (drawdown / maxEquity) * 100;
      
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
      }
    }
    
    return { amount: maxDrawdown, percent: maxDrawdownPercent };
  }
  
  private calculateAverageDuration(trades: Trade[]): number {
    // Implementation depends on how you track trade duration
    return 0;
  }
}
```

## 9. Error Handling

```typescript
// Custom error classes
class TradingBotError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'TradingBotError';
  }
}

class ValidationError extends TradingBotError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

class RiskLimitError extends TradingBotError {
  constructor(message: string) {
    super(message, 'RISK_LIMIT_ERROR', 403);
    this.name = 'RiskLimitError';
  }
}

class ExchangeError extends TradingBotError {
  constructor(message: string) {
    super(message, 'EXCHANGE_ERROR', 502);
    this.name = 'ExchangeError';
  }
}

class StrategyError extends TradingBotError {
  constructor(message: string) {
    super(message, 'STRATEGY_ERROR', 500);
    this.name = 'StrategyError';
  }
}
```

## 10. Logging Structure

```typescript
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: string;
  strategyId?: string;
  orderId?: string;
  positionId?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Example log entries
const logExamples = {
  strategyStart: {
    timestamp: '2026-02-04T22:00:00.000Z',
    level: 'info',
    message: 'Strategy started',
    context: 'StrategyManager',
    strategyId: 'dca-btc-001',
    metadata: { mode: 'paper', symbol: 'BTC/USDT' }
  },
  orderFilled: {
    timestamp: '2026-02-04T22:05:00.000Z',
    level: 'info',
    message: 'Order filled',
    context: 'ExecutionEngine',
    strategyId: 'dca-btc-001',
    orderId: 'order-123',
    metadata: { side: 'buy', quantity: 0.001, price: 45000 }
  },
  riskLimitHit: {
    timestamp: '2026-02-04T22:10:00.000Z',
    level: 'warn',
    message: 'Risk limit reached',
    context: 'RiskManager',
    strategyId: 'grid-eth-001',
    metadata: { limit: 'maxDrawdown', current: 21, max: 20 }
  },
  error: {
    timestamp: '2026-02-04T22:15:00.000Z',
    level: 'error',
    message: 'Failed to execute order',
    context: 'ExecutionEngine',
    strategyId: 'dca-btc-001',
    orderId: 'order-456',
    error: {
      name: 'ExchangeError',
      message: 'Insufficient balance',
      stack: '...'
    }
  }
};
```

This technical specification provides the detailed blueprint for implementing the crypto trading bot. All types, interfaces, and implementation details are clearly defined for the development phase.
