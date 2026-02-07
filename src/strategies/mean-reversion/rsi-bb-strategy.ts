/**
 * RSI + Bollinger Bands + ADX Mean Reversion Strategy (v2 — Improved)
 *
 * Strategy Overview:
 * - Buys when price is oversold (RSI < 30) AND touches lower Bollinger Band
 * - Uses ADX regime filter to only trade in ranging/sideways markets (ADX < 25)
 * - Uses volume confirmation to ensure institutional interest at oversold levels
 * - Partial exits: sells 50% at middle BB, remaining 50% at upper BB or RSI overbought
 * - Dynamic ATR-based stop loss and trailing stop using real OHLC data
 * - Cooldown period between trades to avoid rapid-fire losses
 *
 * Best for: Ranging/sideways markets (ADX < 25)
 * Timeframe: 5m - 1h
 *
 * Key improvements over v1:
 * - Real ATR from OHLC data (was faking it with close * 1.01)
 * - ADX regime filter (avoids trending markets where MR fails)
 * - Volume confirmation on entries
 * - Partial exits for better risk/reward
 * - Fixed trend filter direction (was backwards)
 * - Cooldown between trades
 * - Proper exit at upper BB instead of middle BB
 */

import { BaseStrategy } from '../base/base-strategy';
import type { Candle, Signal, Order, MeanReversionParams } from '../../types';
import {
  createOHLCHistory,
  addCandle,
  getLatestATR,
  getLatestADX,
  getLatestRSI,
  getLatestBB,
  getLatestSMA,
  isVolumeSpike,
  recentHigh,
  percentChange,
  type OHLCHistory,
} from '../../utils/indicators';

interface MeanReversionState {
  // Full OHLC history for proper indicator calculations
  history: OHLCHistory;

  // Position state
  inPosition: boolean;
  entryPrice: number;
  entryTime: number;
  trailingStopPrice: number;
  positionQuantity: number;
  hasPartiallyExited: boolean; // Track if we've taken partial profits

  // Trade management
  buyConfirmationCount: number;
  candlesSinceLastTrade: number; // Cooldown counter
  candlesInPosition: number; // Hold duration counter
}

export class RSIBBStrategy extends BaseStrategy {
  private mrState: MeanReversionState = {
    history: createOHLCHistory(),
    inPosition: false,
    entryPrice: 0,
    entryTime: 0,
    trailingStopPrice: 0,
    positionQuantity: 0,
    hasPartiallyExited: false,
    buyConfirmationCount: 0,
    candlesSinceLastTrade: 999, // Start high so first trade isn't blocked
    candlesInPosition: 0,
  };

  private params: MeanReversionParams;

  constructor(config: any) {
    super(config);
    this.params = config.parameters as MeanReversionParams;

    // Set defaults for all parameters
    this.params.rsiPeriod = this.params.rsiPeriod ?? 14;
    this.params.rsiOversold = this.params.rsiOversold ?? 30;
    this.params.rsiOverbought = this.params.rsiOverbought ?? 70;
    this.params.rsiPartialExitLevel = this.params.rsiPartialExitLevel ?? 55;
    this.params.bbPeriod = this.params.bbPeriod ?? 20;
    this.params.bbStdDev = this.params.bbStdDev ?? 2;
    this.params.atrPeriod = this.params.atrPeriod ?? 14;
    this.params.atrStopMultiplier = this.params.atrStopMultiplier ?? 2.0;
    this.params.atrTrailMultiplier = this.params.atrTrailMultiplier ?? 1.5;
    this.params.adxPeriod = this.params.adxPeriod ?? 14;
    this.params.adxMaxThreshold = this.params.adxMaxThreshold ?? 25;
    this.params.enableADXFilter = this.params.enableADXFilter ?? true;
    this.params.volumeMAPeriod = this.params.volumeMAPeriod ?? 20;
    this.params.volumeSpikeMultiplier = this.params.volumeSpikeMultiplier ?? 1.5;
    this.params.enableVolumeFilter = this.params.enableVolumeFilter ?? true;
    this.params.positionSizePercent = this.params.positionSizePercent ?? 5;
    this.params.stopLossPercent = this.params.stopLossPercent ?? 2;
    this.params.takeProfitPercent = this.params.takeProfitPercent ?? 3;
    this.params.enablePartialExit = this.params.enablePartialExit ?? true;
    this.params.partialExitPercent = this.params.partialExitPercent ?? 50;
    this.params.minDropPercent = this.params.minDropPercent ?? 2;
    this.params.confirmationCandles = this.params.confirmationCandles ?? 1;
    this.params.cooldownCandles = this.params.cooldownCandles ?? 3;
    this.params.maxHoldCandles = this.params.maxHoldCandles ?? 96;
    this.params.smaPeriod = this.params.smaPeriod ?? 200;
    this.params.enableTrendFilter = this.params.enableTrendFilter ?? false;
  }

  async initialize(): Promise<void> {
    await super.initialize();

    // Load state if resuming
    const savedState = this.getState();
    if (savedState.customState?.meanReversion) {
      this.mrState = savedState.customState.meanReversion;
    }

    this.log('info', 'RSI+BB+ADX Mean Reversion Strategy v2 initialized', {
      symbol: this.config.symbol,
      rsiPeriod: this.params.rsiPeriod,
      rsiOversold: this.params.rsiOversold,
      rsiOverbought: this.params.rsiOverbought,
      bbPeriod: this.params.bbPeriod,
      adxMaxThreshold: this.params.adxMaxThreshold,
      enableADXFilter: this.params.enableADXFilter,
      enableVolumeFilter: this.params.enableVolumeFilter,
      enablePartialExit: this.params.enablePartialExit,
      positionSizePercent: this.params.positionSizePercent,
    });
  }

  async onCandle(candle: Candle): Promise<Signal[]> {
    if (!this.isActive()) {
      return [];
    }

    const signals: Signal[] = [];

    // Calculate max history needed for all indicators
    const maxHistory = Math.max(
      this.params.rsiPeriod + 10,
      this.params.bbPeriod + 10,
      this.params.atrPeriod * 2 + 10,
      this.params.adxPeriod * 3 + 10, // ADX needs more data
      this.params.volumeMAPeriod + 10,
      (this.params.smaPeriod || 200) + 10
    );

    // Add candle to OHLC history
    addCandle(this.mrState.history, candle, maxHistory);

    // Increment counters
    this.mrState.candlesSinceLastTrade++;
    if (this.mrState.inPosition) {
      this.mrState.candlesInPosition++;
    }

    const { closes, volumes } = this.mrState.history;

    // Need enough data for indicators
    if (closes.length < Math.max(this.params.bbPeriod, this.params.rsiPeriod + 1)) {
      return [];
    }

    // ============================================================
    // Calculate all indicators
    // ============================================================

    const currentPrice = candle.close;
    const currentRSI = getLatestRSI(closes, this.params.rsiPeriod);
    const currentBB = getLatestBB(closes, this.params.bbPeriod, this.params.bbStdDev);
    const currentATR = getLatestATR(this.mrState.history, this.params.atrPeriod);
    const currentADX = this.params.enableADXFilter
      ? getLatestADX(this.mrState.history, this.params.adxPeriod)
      : null;
    const trendSMA = this.params.enableTrendFilter
      ? getLatestSMA(closes, this.params.smaPeriod || 200)
      : null;

    // Skip if critical indicators aren't ready
    if (currentRSI === null || currentBB === null) {
      return [];
    }

    // ============================================================
    // REGIME FILTER: Only trade in ranging markets
    // ============================================================

    let regimePass = true;
    if (this.params.enableADXFilter && currentADX !== null) {
      regimePass = currentADX.adx < this.params.adxMaxThreshold;
    }

    // ============================================================
    // TREND FILTER: Optionally only buy dips in uptrends
    // ============================================================

    let trendFilterPass = true;
    if (this.params.enableTrendFilter && trendSMA !== null) {
      // Buy dips in uptrends: price should be ABOVE SMA (was backwards in v1)
      trendFilterPass = currentPrice > trendSMA;
    }

    // ============================================================
    // VOLUME FILTER: Confirm with above-average volume
    // ============================================================

    let volumePass = true;
    if (this.params.enableVolumeFilter) {
      volumePass = isVolumeSpike(
        volumes,
        this.params.volumeMAPeriod,
        this.params.volumeSpikeMultiplier
      );
    }

    // ============================================================
    // COOLDOWN CHECK
    // ============================================================

    const cooldownPass = this.mrState.candlesSinceLastTrade >= this.params.cooldownCandles;

    // ============================================================
    // BUY SIGNAL CONDITIONS
    // ============================================================

    const recentHighPrice = recentHigh(closes, 10);
    const priceDropPercent = Math.abs(percentChange(recentHighPrice, currentPrice));

    const isOversold = currentRSI < this.params.rsiOversold;
    const touchedLowerBB = currentPrice <= currentBB.lower;
    const sufficientDrop = priceDropPercent >= this.params.minDropPercent;

    if (
      isOversold &&
      touchedLowerBB &&
      sufficientDrop &&
      regimePass &&
      trendFilterPass &&
      cooldownPass &&
      !this.mrState.inPosition
    ) {
      this.mrState.buyConfirmationCount++;

      if (this.mrState.buyConfirmationCount >= this.params.confirmationCandles) {
        // Generate BUY signal
        const quantity = this.calculatePositionSize(currentPrice);

        // Dynamic stop loss: ATR-based if available, otherwise fixed %
        const stopLoss = currentATR !== null
          ? currentPrice - currentATR * this.params.atrStopMultiplier
          : currentPrice * (1 - this.params.stopLossPercent / 100);

        // Take profit at upper BB (full reversion) or fixed %
        const takeProfit = currentBB.upper > currentPrice
          ? currentBB.upper
          : currentPrice * (1 + this.params.takeProfitPercent / 100);

        const buySignal = this.createSignal(
          'buy',
          quantity,
          undefined, // Market order
          stopLoss,
          takeProfit,
          `MR Buy: RSI=${currentRSI.toFixed(1)}, Price≤LowerBB(${currentBB.lower.toFixed(2)}), ` +
          `ADX=${currentADX?.adx.toFixed(1) ?? 'N/A'}, Vol=${volumePass ? 'SPIKE' : 'normal'}`
        );

        signals.push(buySignal);

        // Update state
        this.mrState.inPosition = true;
        this.mrState.entryPrice = currentPrice;
        this.mrState.entryTime = candle.timestamp;
        this.mrState.positionQuantity = quantity;
        this.mrState.hasPartiallyExited = false;
        this.mrState.candlesInPosition = 0;
        this.mrState.candlesSinceLastTrade = 0;
        this.mrState.buyConfirmationCount = 0;

        // Set initial trailing stop
        this.mrState.trailingStopPrice = currentATR !== null
          ? currentPrice - currentATR * this.params.atrTrailMultiplier
          : currentPrice * (1 - this.params.stopLossPercent / 100);

        this.log('info', 'BUY signal generated', {
          price: currentPrice,
          rsi: currentRSI.toFixed(1),
          bbLower: currentBB.lower.toFixed(2),
          bbUpper: currentBB.upper.toFixed(2),
          adx: currentADX?.adx.toFixed(1) ?? 'N/A',
          atr: currentATR?.toFixed(2) ?? 'N/A',
          volumeSpike: volumePass,
          quantity: quantity.toFixed(6),
          stopLoss: stopLoss.toFixed(2),
          takeProfit: takeProfit.toFixed(2),
        });
      }
    } else if (!isOversold) {
      // Reset confirmation count if RSI is no longer oversold
      this.mrState.buyConfirmationCount = 0;
    }

    // ============================================================
    // SELL SIGNAL CONDITIONS (when in position)
    // ============================================================

    if (this.mrState.inPosition) {
      // Update trailing stop (only moves up, never down)
      if (currentATR !== null) {
        const newTrailingStop = currentPrice - currentATR * this.params.atrTrailMultiplier;
        this.mrState.trailingStopPrice = Math.max(
          this.mrState.trailingStopPrice,
          newTrailingStop
        );
      }

      const profitPercent = percentChange(this.mrState.entryPrice, currentPrice);
      const trailingStopHit = currentPrice <= this.mrState.trailingStopPrice;
      const fixedStopHit = currentPrice <= this.mrState.entryPrice * (1 - this.params.stopLossPercent / 100);
      const maxHoldReached = this.mrState.candlesInPosition >= this.params.maxHoldCandles;

      // ---- PARTIAL EXIT: Sell half at middle BB or RSI partial level ----
      if (
        this.params.enablePartialExit &&
        !this.mrState.hasPartiallyExited &&
        (currentPrice >= currentBB.middle || currentRSI >= this.params.rsiPartialExitLevel)
      ) {
        const partialQuantity = this.mrState.positionQuantity * (this.params.partialExitPercent / 100);

        const partialSellSignal = this.createSignal(
          'sell',
          partialQuantity,
          undefined,
          undefined,
          undefined,
          `MR Partial Exit (${this.params.partialExitPercent}%): ` +
          `${currentPrice >= currentBB.middle ? 'Middle BB' : `RSI=${currentRSI.toFixed(1)}`} ` +
          `(${profitPercent.toFixed(2)}% profit)`
        );

        signals.push(partialSellSignal);
        this.mrState.hasPartiallyExited = true;
        this.mrState.positionQuantity -= partialQuantity;

        this.log('info', 'PARTIAL SELL signal generated', {
          price: currentPrice,
          partialQuantity: partialQuantity.toFixed(6),
          remainingQuantity: this.mrState.positionQuantity.toFixed(6),
          profitPercent: profitPercent.toFixed(2),
          reason: currentPrice >= currentBB.middle ? 'Middle BB reached' : 'RSI partial level',
        });
      }

      // ---- FULL EXIT: Sell remaining at upper BB, RSI overbought, stops, or max hold ----
      const isOverbought = currentRSI >= this.params.rsiOverbought;
      const reachedUpperBB = currentPrice >= currentBB.upper;

      if (
        reachedUpperBB ||
        isOverbought ||
        trailingStopHit ||
        fixedStopHit ||
        maxHoldReached
      ) {
        const remainingQuantity = this.mrState.positionQuantity;

        if (remainingQuantity > 0) {
          let reason = '';
          if (reachedUpperBB) reason = 'Upper BB reached';
          else if (isOverbought) reason = `RSI overbought (${currentRSI.toFixed(1)})`;
          else if (trailingStopHit) reason = 'Trailing stop hit';
          else if (fixedStopHit) reason = 'Fixed stop loss hit';
          else if (maxHoldReached) reason = `Max hold (${this.params.maxHoldCandles} candles)`;

          const sellSignal = this.createSignal(
            'sell',
            remainingQuantity,
            undefined,
            undefined,
            undefined,
            `MR Full Exit: ${reason} (${profitPercent.toFixed(2)}% profit)`
          );

          signals.push(sellSignal);

          this.log('info', 'FULL SELL signal generated', {
            price: currentPrice,
            entryPrice: this.mrState.entryPrice.toFixed(2),
            profitPercent: profitPercent.toFixed(2),
            reason,
            holdCandles: this.mrState.candlesInPosition,
          });
        }

        // Reset position state
        this.mrState.inPosition = false;
        this.mrState.entryPrice = 0;
        this.mrState.entryTime = 0;
        this.mrState.trailingStopPrice = 0;
        this.mrState.positionQuantity = 0;
        this.mrState.hasPartiallyExited = false;
        this.mrState.candlesInPosition = 0;
        this.mrState.candlesSinceLastTrade = 0;
      }
    }

    // ============================================================
    // Update state for persistence
    // ============================================================

    this.setState({
      lastProcessedCandle: candle.timestamp,
      indicators: {
        rsi: currentRSI,
        bbUpper: currentBB.upper,
        bbMiddle: currentBB.middle,
        bbLower: currentBB.lower,
        bbBandwidth: currentBB.bandwidth,
        atr: currentATR,
        adx: currentADX?.adx ?? null,
        plusDI: currentADX?.plusDI ?? null,
        minusDI: currentADX?.minusDI ?? null,
        trendSMA: trendSMA,
      },
      customState: { meanReversion: this.mrState },
    });

    return signals;
  }

  async onOrderFilled(order: Order): Promise<void> {
    await super.onOrderFilled(order);

    if (order.side === 'buy') {
      this.mrState.inPosition = true;
      this.mrState.entryPrice = order.averageFillPrice;
      this.mrState.entryTime = order.filledAt?.getTime() || Date.now();
      this.mrState.positionQuantity = order.filledQuantity;

      this.log('info', 'Position opened', {
        entryPrice: this.mrState.entryPrice.toFixed(2),
        quantity: order.filledQuantity.toFixed(6),
      });
    } else if (order.side === 'sell') {
      // Track remaining quantity
      this.mrState.positionQuantity -= order.filledQuantity;

      if (this.mrState.positionQuantity <= 0) {
        // Fully closed
        const profit = (order.averageFillPrice - this.mrState.entryPrice) * order.filledQuantity;

        this.log('info', 'Position fully closed', {
          exitPrice: order.averageFillPrice.toFixed(2),
          profit: profit.toFixed(2),
        });

        this.mrState.inPosition = false;
        this.mrState.entryPrice = 0;
        this.mrState.trailingStopPrice = 0;
        this.mrState.positionQuantity = 0;
        this.mrState.hasPartiallyExited = false;
      } else {
        this.log('info', 'Partial position closed', {
          exitPrice: order.averageFillPrice.toFixed(2),
          remainingQuantity: this.mrState.positionQuantity.toFixed(6),
        });
      }
    }
  }

  /**
   * Calculate position size based on risk parameters
   */
  private calculatePositionSize(currentPrice: number): number {
    const capital = this.config.currentCapital;
    const positionSizePercent = this.params.positionSizePercent || 5;

    const positionValue = capital * (positionSizePercent / 100);
    return positionValue / currentPrice;
  }

  /**
   * Get current indicator values (for monitoring)
   */
  getIndicators(): {
    rsi: number | null;
    bbUpper: number | null;
    bbMiddle: number | null;
    bbLower: number | null;
    atr: number | null;
    adx: number | null;
    sma: number | null;
    inPosition: boolean;
    entryPrice: number;
    hasPartiallyExited: boolean;
    candlesInPosition: number;
  } {
    const state = this.getState();
    const indicators = state.indicators || {};

    return {
      rsi: indicators.rsi ?? null,
      bbUpper: indicators.bbUpper ?? null,
      bbMiddle: indicators.bbMiddle ?? null,
      bbLower: indicators.bbLower ?? null,
      atr: indicators.atr ?? null,
      adx: indicators.adx ?? null,
      sma: indicators.trendSMA ?? null,
      inPosition: this.mrState.inPosition,
      entryPrice: this.mrState.entryPrice,
      hasPartiallyExited: this.mrState.hasPartiallyExited,
      candlesInPosition: this.mrState.candlesInPosition,
    };
  }
}
