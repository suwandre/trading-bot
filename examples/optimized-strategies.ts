/**
 * Optimized Strategy Configurations (v2)
 * Updated for the improved strategy ensemble
 *
 * Each strategy specializes in a specific market condition:
 * - RSI+BB: Ranging/sideways markets (ADX < 25)
 * - EMA+MACD+ADX: Trending markets (ADX > 25)
 * - Adaptive Grid: Low-volatility ranging markets (ADX < 20)
 * - Smart DCA: Long-term accumulation with crash protection
 */

export const optimizedStrategies = {
  /**
   * RSI + Bollinger Bands + ADX — Mean Reversion (v2)
   * Best for: Ranging/sideways markets
   * Regime filter: ADX < 25
   */
  rsiBB: {
    id: 'v2-rsi-bb',
    name: 'RSI+BB Mean Reversion v2',
    type: 'mean-reversion' as const,
    symbol: 'BTC/USDT',
    timeframe: '15m',
    mode: 'backtest' as const,
    status: 'active' as const,
    parameters: {
      // RSI
      rsiPeriod: 14,
      rsiOversold: 30,
      rsiOverbought: 70,
      rsiPartialExitLevel: 55,

      // Bollinger Bands
      bbPeriod: 20,
      bbStdDev: 2,

      // ATR (real OHLC-based)
      atrPeriod: 14,
      atrStopMultiplier: 2.0,
      atrTrailMultiplier: 1.5,

      // ADX Regime Filter
      adxPeriod: 14,
      adxMaxThreshold: 25,
      enableADXFilter: true,

      // Volume Confirmation
      volumeMAPeriod: 20,
      volumeSpikeMultiplier: 1.5,
      enableVolumeFilter: true,

      // Trading
      positionSizePercent: 5,
      stopLossPercent: 2,
      takeProfitPercent: 3,

      // Partial Exit
      enablePartialExit: true,
      partialExitPercent: 50,

      // Filters
      minDropPercent: 2,
      confirmationCandles: 1,
      cooldownCandles: 3,
      maxHoldCandles: 96,

      // Trend Filter (optional — buy dips in uptrends)
      smaPeriod: 200,
      enableTrendFilter: false,
    },
    riskParams: {
      stopLossPercent: 2,
      takeProfitPercent: 3,
      maxPositionSize: 500,
      maxOpenPositions: 2,
      maxDrawdownPercent: 15,
      positionSizePercent: 5,
    },
  },

  /**
   * EMA + MACD + ADX — Trend Following (v2)
   * Best for: Strong trending markets
   * Regime filter: ADX > 25
   */
  trendFollowing: {
    id: 'v2-trend',
    name: 'EMA+MACD+ADX Trend v2',
    type: 'trend-following' as const,
    symbol: 'BTC/USDT',
    timeframe: '15m',
    mode: 'backtest' as const,
    status: 'active' as const,
    parameters: {
      // EMAs
      fastEMAPeriod: 12,
      slowEMAPeriod: 26,
      trendEMAPeriod: 50,

      // MACD
      macdFastPeriod: 12,
      macdSlowPeriod: 26,
      macdSignalPeriod: 9,

      // ADX Regime Filter
      adxPeriod: 14,
      adxMinThreshold: 25,
      enableADXFilter: true,

      // ATR (real OHLC-based)
      atrPeriod: 14,
      atrStopMultiplier: 2.0,
      atrTrailMultiplier: 3.0,

      // Volume Confirmation
      volumeMAPeriod: 20,
      volumeSpikeMultiplier: 1.2,
      enableVolumeFilter: true,

      // Trading
      positionSizePercent: 7,
      stopLossPercent: 5,

      // Exit
      confirmationCandles: 2,
      maxHoldCandles: 192,
      cooldownCandles: 5,
    },
    riskParams: {
      stopLossPercent: 5,
      maxPositionSize: 700,
      maxOpenPositions: 2,
      maxDrawdownPercent: 15,
      positionSizePercent: 7,
    },
  },

  /**
   * Adaptive Grid (v3) - IMPROVED
   * Best for: Low-volatility ranging markets
   * Regime filter: ADX < 25
   *
   * v3 Improvements:
   * - Tighter ATR spacing (0.2 instead of 0.5)
   * - More grid levels (20 instead of 10)
   * - Multi-level buying and selling
   * - Dynamic position sizing (larger at lower prices)
   * - Trailing stop to lock in profits
   */
  adaptiveGrid: {
    id: 'v3-grid',
    name: 'Adaptive Grid v3',
    type: 'grid' as const,
    symbol: 'BTC/USDT',
    timeframe: '15m',
    mode: 'backtest' as const,
    status: 'active' as const,
    parameters: {
      // Grid Structure - v3: tighter, more levels
      gridLevels: 20,              // Increased from 10
      gridSpacingPercent: 0.5,     // Tighter from 1%

      // Adaptive Grid
      useAdaptiveGrid: true,
      atrPeriod: 14,
      atrGridMultiplier: 0.2,      // Tighter spacing from 0.5
      recenterThreshold: 2,

      // Static fallback (not used when adaptive is on)
      upperPrice: 0,
      lowerPrice: 0,

      // Position Sizing - v3: larger positions
      quantityPerGrid: 0, // Auto-calculate from positionSizePercent
      maxPositionsPerSide: 8,      // Increased from 5
      positionSizePercent: 5,       // Increased from 3%

      // Risk - v3: wider stop buffer
      stopLossATRMultiplier: 3,     // Increased from 2
      enableStopLoss: true,

      // ADX Regime Filter - v3: relaxed threshold
      adxPeriod: 14,
      adxMaxThreshold: 25,          // Relaxed from 20
      enableADXFilter: true,

      // Profits
      reinvestProfits: true,
      reinvestPercent: 50,

      // v3: Multi-level Trading
      levelsPerBuy: 3,             // Buy at 3 lower levels
      levelsToSellAbove: 2,       // Sell at 2+ levels above

      // v3: Trailing Stop
      enableTrailingStop: true,
      trailingStopPercent: 1,      // 1% trailing stop
    },
    riskParams: {
      maxPositionSize: 5000,
      maxOpenPositions: 8,
      maxDrawdownPercent: 15,
    },
  },

  /**
   * Smart DCA (v2)
   * Best for: Long-term accumulation with crash protection
   */
  smartDCA: {
    id: 'v2-dca',
    name: 'Smart DCA v2',
    type: 'dca' as const,
    symbol: 'BTC/USDT',
    timeframe: '1h',
    mode: 'backtest' as const,
    status: 'active' as const,
    parameters: {
      investmentAmount: 50,
      interval: 'daily',
      takeProfitPercent: 5,

      // Average Down
      averageDown: true,
      averageDownPercent: 5,
      maxAverageDowns: 3,
      averageDownScaling: 1.5,

      // Crash Detection
      enableCrashDetection: true,
      crashRSIPeriod: 14,
      crashRSIThreshold: 25,
      crashSMAPeriod: 200,
      crashSMADropPercent: 10,

      // Partial Take Profit
      enablePartialTakeProfit: true,
      partialTakeProfitPercent: 50,
      trailingStopPercent: 2,

      // Limits
      maxTotalInvestment: 5000,

      // Dip Buying
      enableDipBuying: true,
      dipRSIThreshold: 35,
      dipBuyMultiplier: 1.5,
    },
    riskParams: {
      stopLossPercent: 20,
      maxPositionSize: 5000,
      maxOpenPositions: 1,
      maxDrawdownPercent: 20,
    },
  },
};

/**
 * Strategy Selection Guide (v2)
 * Each strategy has built-in regime filters, so they can all run simultaneously
 * without conflicting. The ADX filter ensures they only trade in their optimal conditions.
 */
export const strategySelectionGuide = {
  trending_up: {
    description: 'Strong uptrend (ADX > 25, +DI > -DI)',
    active: 'EMA+MACD+ADX Trend Strategy',
    inactive: ['RSI+BB (ADX filter blocks)', 'Grid (ADX filter blocks)'],
    dca: 'Smart DCA continues accumulating',
  },
  trending_down: {
    description: 'Strong downtrend (ADX > 25, -DI > +DI)',
    active: 'None — all long strategies stay flat',
    inactive: ['All strategies filtered out by ADX + DI direction'],
    dca: 'Smart DCA pauses (crash detection)',
  },
  ranging: {
    description: 'Sideways market (ADX < 25)',
    active: 'RSI+BB Mean Reversion',
    alternative: 'Adaptive Grid (if ADX < 20)',
    dca: 'Smart DCA continues accumulating',
  },
  low_volatility: {
    description: 'Tight range, low ATR (ADX < 20)',
    active: 'Adaptive Grid (optimal conditions)',
    alternative: 'RSI+BB (if oversold bounces occur)',
    dca: 'Smart DCA continues accumulating',
  },
  volatile: {
    description: 'High volatility, unclear direction',
    active: 'RSI+BB with tight stops',
    inactive: ['Grid paused (too volatile)', 'Trend paused (no clear direction)'],
    dca: 'Smart DCA may pause if crash detected',
  },
};

/**
 * v1 vs v3 Performance Comparison
 * (v1 results from multi-period backtest, v3 targets)
 */
export const performanceComparison = {
  rsiBB: {
    v1: { avgPnL: 0.93, winRate: 27.78, sharpe: 0.01, consistency: 'MODERATE' },
    v3Target: { avgPnL: '50-100', winRate: '45-55', sharpe: '>0.5', consistency: 'GOOD' },
    improvements: [
      'Real ATR from OHLC (was faking it)',
      'ADX regime filter (avoids trending markets)',
      'Volume confirmation on entries',
      'Partial exits (50% at middle BB, 50% at upper BB)',
      'Fixed trend filter direction (was backwards)',
      'Cooldown between trades',
    ],
  },
  trendFollowing: {
    v1: { avgPnL: -157.90, winRate: 26.34, sharpe: -1.11, consistency: 'POOR' },
    v3Target: { avgPnL: '30-80', winRate: '35-45', sharpe: '>0', consistency: 'MODERATE' },
    improvements: [
      'Replaced SMA with EMA (faster response)',
      'Added MACD momentum confirmation',
      'ADX trend strength filter (avoids whipsaws)',
      'Volume confirmation',
      'ATR-based trailing stop (lets winners run)',
      'No premature exit on minor pullbacks',
    ],
  },
  grid: {
    v1: { avgPnL: 0, winRate: 0, sharpe: 0, consistency: 'NO DATA' },
    v2: { avgPnL: 1814.83, winRate: 40.77, sharpe: 0.32, consistency: 'MODERATE' },
    v3Target: { avgPnL: '2500-4000', winRate: '50-60', sharpe: '>0.6', consistency: 'GOOD' },
    improvements: [
      'Tighter ATR spacing (0.2 instead of 0.5)',
      'More grid levels (20 instead of 10)',
      'Multi-level buying (3 levels instead of 1)',
      'Multi-level profit taking (sell at any upper grid)',
      'Dynamic position sizing (larger at lower prices)',
      'Trailing stop to lock in profits',
      'Relaxed ADX filter (25 instead of 20)',
    ],
  },
  dca: {
    v1: { avgPnL: -260.01, winRate: 35.35, sharpe: -0.23, consistency: 'INCONSISTENT' },
    v3Target: { avgPnL: '10-30', winRate: '50-60', sharpe: '>0', consistency: 'MODERATE' },
    improvements: [
      'Crash detection pauses buying',
      'Dip buying with RSI confirmation',
      'Scaled average-down amounts',
      'Partial take profit (50% at target)',
      'Trailing stop on remaining position',
      'Max investment cap',
    ],
  },
};
