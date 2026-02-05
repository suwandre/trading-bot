# Deployment Guide - Trading Bot V2

This guide covers deploying the trading bot to Railway with MongoDB.

## 🚂 Railway Deployment

### Prerequisites
- Railway account (https://railway.app)
- GitHub repository (optional, for automatic deployments)
- API keys for Binance and MEXC

### Step 1: Create Railway Project

1. Go to https://railway.app
2. Click "New Project"
3. Choose "Deploy from GitHub repo" or "Empty Project"

### Step 2: Add MongoDB

1. In your Railway project, click "New"
2. Select "Database" → "MongoDB"
3. Railway will create a MongoDB container
4. Note the connection string (automatically available as `MONGODB_URI`)

### Step 3: Configure Environment Variables

In Railway project settings, add these variables:

```env
# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# MongoDB (automatically set by Railway)
MONGODB_ENABLED=true
# MONGODB_URI is automatically provided by Railway

# Binance API
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
BINANCE_TESTNET=false

# MEXC API
MEXC_API_KEY=your_mexc_api_key
MEXC_API_SECRET=your_mexc_api_secret
MEXC_TESTNET=false

# Risk Management
MAX_TOTAL_EXPOSURE=10000
MAX_DAILY_LOSS=500
MAX_DRAWDOWN_PERCENT=20
EMERGENCY_STOP_ENABLED=true

# WebSocket
WS_ENABLED=true
WS_HEARTBEAT_INTERVAL=30000

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

### Step 4: Deploy

#### Option A: From GitHub

1. Connect your GitHub repository
2. Railway will automatically detect the Dockerfile
3. Click "Deploy"
4. Railway will build and deploy automatically

#### Option B: From CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up
```

### Step 5: Verify Deployment

1. Check the deployment logs in Railway dashboard
2. Visit the health endpoint: `https://your-app.railway.app/health`
3. Test the API: `https://your-app.railway.app/api/strategies`

## 🐳 Docker Deployment (Alternative)

### Local Docker

```bash
# Build image
docker build -t trading-bot-v2 .

# Run container
docker run -d \
  --name trading-bot \
  -p 3000:3000 \
  --env-file .env \
  trading-bot-v2
```

### Docker Compose

```bash
# Start all services (app + MongoDB)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 🔧 Configuration

### MongoDB Connection

Railway automatically provides `MONGODB_URI`. The format is:
```
mongodb://username:password@host:port/database
```

### API Keys

**Important**: Never commit API keys to version control!

- Store keys in Railway environment variables
- Use Railway's secret management
- Rotate keys regularly

### Resource Limits

Railway free tier:
- 500 hours/month
- 512MB RAM
- 1GB disk

For production, consider upgrading to:
- Pro plan: $20/month
- More resources
- Better performance

## 📊 Monitoring

### Health Checks

Railway automatically monitors:
- `/health` endpoint
- Container health
- Resource usage

### Logs

View logs in Railway dashboard or via CLI:
```bash
railway logs
```

### Metrics

Monitor:
- API response times
- Strategy performance
- Error rates
- Resource usage

## 🔐 Security

### API Keys
- Use Railway secrets
- Never expose in logs
- Rotate regularly

### Network
- Railway provides HTTPS automatically
- Use environment variables for sensitive data
- Enable rate limiting

### Database
- MongoDB is in private network
- No egress fees (Railway internal)
- Automatic backups (Pro plan)

## 🚀 Scaling

### Horizontal Scaling
Railway supports multiple instances:
```bash
railway scale --replicas 3
```

### Vertical Scaling
Upgrade resources in Railway dashboard:
- More RAM
- More CPU
- More disk space

## 🔄 Updates

### Automatic Deployments
If connected to GitHub:
- Push to main branch
- Railway auto-deploys
- Zero-downtime deployments

### Manual Deployments
```bash
railway up
```

## 🐛 Troubleshooting

### Common Issues

**1. MongoDB Connection Failed**
- Check `MONGODB_URI` is set
- Verify MongoDB container is running
- Check network connectivity

**2. API Keys Invalid**
- Verify keys in environment variables
- Check key permissions on exchange
- Ensure keys are not expired

**3. Out of Memory**
- Reduce cache size
- Limit concurrent strategies
- Upgrade Railway plan

**4. Slow Performance**
- Enable caching
- Optimize strategy logic
- Consider upgrading resources

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
```

View detailed logs in Railway dashboard.

## 📝 Best Practices

1. **Start Small**: Test with paper trading first
2. **Monitor Closely**: Watch logs and metrics
3. **Set Limits**: Configure risk limits appropriately
4. **Backup Data**: Export important data regularly
5. **Test Thoroughly**: Backtest before live trading
6. **Use Alerts**: Set up notifications for errors
7. **Keep Updated**: Update dependencies regularly

## 🆘 Support

- Check logs: `railway logs`
- Review metrics in Railway dashboard
- Test locally with Docker first
- Verify environment variables

## 📚 Additional Resources

- Railway Docs: https://docs.railway.app
- Docker Docs: https://docs.docker.com
- MongoDB Docs: https://docs.mongodb.com
- Project README: [README.md](./README.md)

---

**Ready to deploy!** Follow the steps above to get your trading bot running on Railway.
