# API Documentation - Trading Bot V2

Base URL: `http://localhost:3000` (development) or `https://your-app.railway.app` (production)

## 📡 Endpoints

### Health & Status

#### GET /health
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1707084000000,
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "database": "enabled",
    "websocket": "enabled"
  }
}
```

### Strategies

#### POST /api/strategies
Create a new strategy

**Request Body:**
```json
{
  "id": "dca-btc-001",
  "name": "BTC Daily DCA",
  "type": "dca",
  "symbol": "BTC/USDT",
  "timeframe": "15m",
  "mode": "paper",
  "parameters": {
    "investmentAmount": 100,
    "interval": "daily"
  },
  "riskParams": {
    "maxPositionSize": 5000,
    "maxOpenPositions": 1,
    "maxDrawdownPercent": 20
  },
  "initialCapital": 10000
}
```

**Response:**
```json
{
  "success": true,
  "strategy": { /* strategy config */ }
}
```

#### GET /api/strategies
List all strategies

**Response:**
```json
{
  "success": true,
  "strategies": [ /* array of strategies */ ],
  "total": 3
}
```

#### GET /api/strategies/:id
Get strategy details

**Response:**
```json
{
  "success": true,
  "strategy": { /* strategy config */ },
  "metrics": { /* performance metrics */ },
  "state": { /* runtime state */ }
}
```

#### PATCH /api/strategies/:id
Update strategy configuration

**Request Body:**
```json
{
  "parameters": {
    "investmentAmount": 150
  }
}
```

#### DELETE /api/strategies/:id
Delete a strategy

#### POST /api/strategies/:id/start
Start a strategy

#### POST /api/strategies/:id/stop
Stop a strategy

#### POST /api/strategies/:id/pause
Pause a strategy

#### POST /api/strategies/:id/resume
Resume a strategy

#### GET /api/strategies/:id/metrics
Get strategy performance metrics

**Response:**
```json
{
  "success": true,
  "metrics": {
    "strategyId": "dca-btc-001",
    "totalTrades": 45,
    "winningTrades": 30,
    "losingTrades": 15,
    "winRate": 0.6667,
    "totalPnL": 1250.50,
    "totalPnLPercent": 12.51,
    "sharpeRatio": 1.85,
    "maxDrawdownPercent": 4.50
  }
}
```

### Positions

#### GET /api/positions
List all positions

**Query Parameters:**
- `strategyId` (optional): Filter by strategy
- `status` (optional): Filter by status (open/closed)

**Response:**
```json
{
  "success": true,
  "positions": [ /* array of positions */ ],
  "total": 5,
  "totalPnL": 250.50
}
```

#### GET /api/positions/:id
Get position details

#### POST /api/positions/:id/close
Manually close a position

**Request Body:**
```json
{
  "price": 45000 // optional, uses current price if not provided
}
```

#### GET /api/positions/stats
Get position statistics

### Backtesting

#### POST /api/backtest
Run a backtest

**Request Body:**
```json
{
  "strategy": { /* strategy config */ },
  "symbol": "BTC/USDT",
  "timeframe": "15m",
  "startTime": 1704067200000,
  "endTime": 1707084000000,
  "initialCapital": 10000,
  "feeRate": 0.001,
  "slippagePercent": 0.05
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "config": { /* backtest config */ },
    "metrics": { /* performance metrics */ },
    "trades": [ /* array of trades */ ],
    "equity": [ /* equity curve */ ],
    "drawdown": [ /* drawdown curve */ ],
    "duration": 2450,
    "candlesProcessed": 2880
  }
}
```

#### GET /api/backtest/progress
Get current backtest progress

#### POST /api/backtest/pause
Pause running backtest

#### POST /api/backtest/resume
Resume paused backtest

#### POST /api/backtest/stop
Stop running backtest

## 🔌 WebSocket API

Connect to: `ws://localhost:3000/ws`

### Client → Server Messages

#### Subscribe to Strategy Updates
```json
{
  "type": "subscribe:strategy",
  "payload": {
    "strategyId": "dca-btc-001"
  }
}
```

#### Subscribe to Position Updates
```json
{
  "type": "subscribe:positions",
  "payload": {
    "strategyId": "dca-btc-001" // optional
  }
}
```

#### Ping
```json
{
  "type": "ping"
}
```

### Server → Client Messages

#### Connected
```json
{
  "type": "connected",
  "message": "Connected to Trading Bot WebSocket",
  "timestamp": 1707084000000
}
```

#### Heartbeat
```json
{
  "type": "heartbeat",
  "timestamp": 1707084000000
}
```

#### Strategy Update
```json
{
  "type": "strategy:update",
  "strategy": { /* strategy config */ }
}
```

#### Order Filled
```json
{
  "type": "order:filled",
  "order": { /* order details */ }
}
```

#### Position Update
```json
{
  "type": "position:updated",
  "position": { /* position details */ }
}
```

## 📝 Examples

### Create and Start a DCA Strategy

```bash
# Create strategy
curl -X POST http://localhost:3000/api/strategies \
  -H "Content-Type: application/json" \
  -d @examples/dca-strategy-example.json

# Start strategy
curl -X POST http://localhost:3000/api/strategies/dca-btc-daily/start
```

### Run a Backtest

```bash
curl -X POST http://localhost:3000/api/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": { /* strategy config */ },
    "symbol": "BTC/USDT",
    "timeframe": "15m",
    "startTime": 1704067200000,
    "endTime": 1707084000000,
    "initialCapital": 10000,
    "feeRate": 0.001,
    "slippagePercent": 0.05
  }'
```

### Get All Positions

```bash
curl http://localhost:3000/api/positions
```

### WebSocket Connection (JavaScript)

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('Connected');
  
  // Subscribe to strategy updates
  ws.send(JSON.stringify({
    type: 'subscribe:strategy',
    payload: { strategyId: 'dca-btc-001' }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

## 🔒 Authentication

**Note**: Authentication is not yet implemented. For production use, add:
- JWT authentication
- API key authentication
- Rate limiting per user

## ⚠️ Rate Limiting

Default limits:
- 100 requests per minute per IP
- Configurable via environment variables

## 🐛 Error Responses

All errors follow this format:
```json
{
  "error": "ValidationError",
  "message": "Invalid strategy configuration",
  "statusCode": 400
}
```

Common status codes:
- `400`: Bad Request (validation error)
- `403`: Forbidden (risk limit exceeded)
- `404`: Not Found
- `500`: Internal Server Error
- `502`: Exchange Error

## 📊 Response Format

All successful responses include:
```json
{
  "success": true,
  // ... response data
}
```

Failed responses include:
```json
{
  "success": false,
  "error": "Error message"
}
```

---

For more details, see the [Technical Specification](./plans/technical-specification.md).
