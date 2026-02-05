# Trading Bot V2

A versatile crypto trading bot built with TypeScript and Fastify that supports multiple parallel trading strategies (DCA, Grid, Custom), backtesting with historical data, paper trading, and live trading on MEXC.

## 🚀 Features

- **Multiple Trading Strategies**: DCA, Grid Trading, and Custom strategies
- **Parallel Execution**: Run multiple strategies simultaneously
- **Accurate Backtesting**: Test strategies with real historical data (no MongoDB required)
- **Paper Trading**: Simulate live trading without risk
- **Live Trading**: Execute trades on MEXC exchange
- **Comprehensive Risk Management**: Stop-loss, take-profit, position sizing, drawdown limits
- **Real-time Updates**: WebSocket support for live monitoring
- **RESTful API**: Full API for strategy management
- **High Performance**: Built with TypeScript and Fastify

## 📋 Project Status

### ✅ Completed (73% - 22/30 tasks)
- [x] Complete project foundation and type system
- [x] Data layer (Binance & MEXC providers, caching)
- [x] Core engine (Risk Manager, Position Manager, Execution Engine, Strategy Manager)
- [x] **Backtesting system (fully operational)**
- [x] **Three trading strategies (DCA, Grid, Custom SMA)**
- [x] REST API with Fastify
- [x] WebSocket server for real-time updates
- [x] Configuration and logging systems
- [x] Docker & Docker Compose
- [x] Deployment documentation

### 🚧 Remaining (27% - 8/30 tasks)
- [ ] MongoDB integration (optional for backtesting)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Final documentation polish

## 🏗️ Architecture

```
trading-bot-v2/
├── src/
│   ├── types/              # TypeScript type definitions
│   │   ├── common.types.ts
│   │   ├── market.types.ts
│   │   ├── order.types.ts
│   │   ├── position.types.ts
│   │   ├── trade.types.ts
│   │   ├── strategy.types.ts
│   │   ├── backtest.types.ts
│   │   ├── exchange.types.ts
│   │   └── index.ts
│   ├── strategies/         # Trading strategies
│   │   └── base/
│   │       └── base-strategy.ts
│   └── index.ts
├── plans/                  # Architecture documentation
│   ├── architecture-overview.md
│   ├── technical-specification.md
│   ├── implementation-guide.md
│   └── README.md
├── package.json
├── tsconfig.json
└── README.md
```

## 🛠️ Setup

### Prerequisites
- Node.js v20 or higher
- npm or yarn
- (Optional) MongoDB for production deployment

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd trading-bot-v2
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Configure your `.env` file:
```env
# Server
NODE_ENV=development
PORT=3000

# Binance API (for backtesting)
BINANCE_API_KEY=your_key_here
BINANCE_API_SECRET=your_secret_here

# MEXC API (for live trading)
MEXC_API_KEY=your_key_here
MEXC_API_SECRET=your_secret_here

# Risk Management
MAX_TOTAL_EXPOSURE=10000
MAX_DAILY_LOSS=500
MAX_DRAWDOWN_PERCENT=20
```

## 📚 Documentation

Comprehensive planning documentation is available in the [`plans/`](./plans/) directory:

- **[Architecture Overview](./plans/architecture-overview.md)**: High-level system design, components, and data flow
- **[Technical Specification](./plans/technical-specification.md)**: Detailed type definitions, interfaces, and API specs
- **[Implementation Guide](./plans/implementation-guide.md)**: Code examples, best practices, and development phases

## 🎯 Development Roadmap

### Phase 1: Foundation ✅
- [x] Project setup
- [x] Type definitions
- [x] Base strategy class

### Phase 2: Data Layer (Next)
- [ ] Exchange provider interface
- [ ] Binance provider implementation
- [ ] MEXC provider implementation
- [ ] Market data service
- [ ] Data caching

### Phase 3: Core Engine
- [ ] Position manager
- [ ] Risk manager
- [ ] Order simulator
- [ ] Execution engine
- [ ] Strategy manager

### Phase 4: Backtesting
- [ ] Backtesting engine
- [ ] Metrics calculator
- [ ] Report generator

### Phase 5: Strategies
- [ ] DCA strategy
- [ ] Grid strategy
- [ ] Custom strategy template

### Phase 6: API Layer
- [ ] Fastify server setup
- [ ] REST API endpoints
- [ ] WebSocket server

### Phase 7: Database
- [ ] MongoDB integration
- [ ] Mongoose models
- [ ] Data persistence

### Phase 8: Testing & Documentation
- [ ] Unit tests
- [ ] Integration tests
- [ ] API documentation
- [ ] Usage examples

### Phase 9: Deployment
- [ ] Docker configuration
- [ ] Railway deployment
- [ ] Production monitoring

## 🔧 Development Commands

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your API keys
# At minimum, add Binance keys for backtesting
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run a Backtest

```bash
# Run the example backtest
npx tsx examples/run-backtest-example.ts
```

### 4. Start the API Server

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

### 5. Test the API

```bash
# Health check
curl http://localhost:3000/health

# List strategies
curl http://localhost:3000/api/strategies

# Run a backtest via API
curl -X POST http://localhost:3000/api/backtest \
  -H "Content-Type: application/json" \
  -d @examples/backtest-request.json
```

## 📡 API Endpoints

See [`API.md`](./API.md) for complete API documentation.

**Key Endpoints:**
- `GET /health` - Health check
- `POST /api/strategies` - Create strategy
- `GET /api/strategies` - List strategies
- `POST /api/strategies/:id/start` - Start strategy
- `POST /api/backtest` - Run backtest
- `GET /api/positions` - List positions
- `WS /ws` - WebSocket connection

## 🐳 Docker Deployment

### Local Docker

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f trading-bot

# Stop
docker-compose down
```

### Railway Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for complete Railway deployment guide.

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

## 📖 Usage Examples

### Creating a DCA Strategy

```typescript
import { DCAStrategy } from './strategies/dca/dca-strategy';

const dcaConfig = {
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
  },
  riskParams: {
    stopLossPercent: 5,
    maxPositionSize: 5000,
    maxOpenPositions: 1,
    maxDrawdownPercent: 20,
  },
  status: 'active',
  initialCapital: 10000,
  currentCapital: 10000,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const strategy = new DCAStrategy(dcaConfig);
await strategy.initialize();
await strategy.start();
```

### Running a Backtest

```typescript
import { BacktestEngine } from './backtesting/backtest-engine';

const backtestConfig = {
  strategy: strategyConfig,
  symbol: 'BTC/USDT',
  timeframe: '15m',
  startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
  endTime: Date.now(),
  initialCapital: 10000,
  feeRate: 0.001, // 0.1%
  slippagePercent: 0.05, // 0.05%
};

const engine = new BacktestEngine(marketDataService, orderSimulator, metricsCalculator);
const result = await engine.runBacktest(backtestConfig);

console.log('Backtest Results:', {
  totalTrades: result.metrics.totalTrades,
  winRate: result.metrics.winRate,
  totalPnL: result.metrics.totalPnL,
  sharpeRatio: result.metrics.sharpeRatio,
  maxDrawdown: result.metrics.maxDrawdownPercent,
});
```

## 🔐 Security

- API keys are stored in environment variables
- Never commit `.env` files to version control
- Use Railway secrets for production deployment
- Implement rate limiting on all API endpoints
- Enable emergency stop mechanisms

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome!

## 📄 License

MIT

## 🙏 Acknowledgments

- Built with [Fastify](https://www.fastify.io/)
- Exchange integration via [CCXT](https://github.com/ccxt/ccxt)
- Technical indicators from [technicalindicators](https://github.com/anandanand84/technicalindicators)

---

**Note**: This project is under active development. See the [plans/](./plans/) directory for detailed architecture and implementation guides.
