/**
 * EMA + MACD + ADX Trend Following Strategy (v2 — Replaces SMA Crossover)
 *
 * Strategy Overview:
 * - Uses EMA 12/26 for trend direction (faster than SMA)
 * - MACD for momentum confirmation (signal line crossover + histogram)
 * - ADX for trend strength filter (only trades when ADX > 25)
 * - ATR for dynamic stop loss and trailing stop
 * - Volume confirmation on entries
 *
 * Entry: All conditions must be true:
 *   1. ADX > 25 (strong trend)
 *   2. +DI > -DI (bullish directional movement)
 *   3. EMA 12 > EMA 26 (short-term trend up)
 *   4. MACD line > Signal line (momentum confirmation)
 *   5. MACD histogram increasing (momentum accelerating)
 *   6. Price > EMA 50 (medium-term trend confirmation)
 *   7. Volume > 1.2x average (optional)
 *
 * Exit: Any condition triggers exit:
 *   1. MACD line crosses below Signal line
 *   2. ADX drops below 20
 *   3. Trailing stop hit (3x ATR)
 *   4. Fixed stop loss hit (2x ATR)
 *   5. Price closes below slow EMA for N consecutive candles
 *   6. Max hold period reached
 *
 * Best for: Trending markets (ADX > 25)
 * Timeframe: 15m - 1h
 */

import { BaseStrategy } from '../base/base-strategy';
import type { Candle, Signal, Order, TrendFollowingParams } from '../../types';
import {
  createOHLCHistory,
  addCandle,
  getLatestATR,
  getLatestADX,
  getLatestEMA,
  calculateEMA,
  calculateMACD,
  isVolumeSpike,
  percentChange,
  type OHLCHistory,
} from '../../utils/indicators';

interface TrendState {
  // Full OHLC history
  history: OHLCHistory;

  // Position state
  inPosition: boolean;
  entryPrice: number;
  entryTime: number;
  trailingStopPrice: number;
  highestPriceSinceEntry: number;
  positionQuantity: number;

  // Exit tracking
  candlesBelowSlowEMA: number; // Consecutive candles below slow EMA
  candlesInPosition: number;
  candlesSinceLastTrade: number;

  // MACD history for histogram direction
  previousMACDHistogram: number | null;
}

export class EMAMACDADXStrategy extends BaseStrategy {
  private trendState: TrendState = {
    history: createOHLCHistory(),
    inPosition: false,
    entryPrice: 0,
    entryTime: 0,
    trailingStopPrice: 0,
    highestPriceSinceEntry: 0,
    positionQuantity: 0,
    candlesBelowSlowEMA: 0,
    candlesInPosition: 0,
    candlesSinceLastTrade: 999,
    previousMACDHistogram: null,
  };

  private params: TrendFollowingParams;

  constructor(config: any) {
    super(config);
    this.params = config.parameters as TrendFollowingParams;

    // Set defaults
    this.params.fastEMAPeriod = this.params.fastEMAPeriod ?? 12;
    this.params.slowEMAPeriod = this.params.slowEMAPeriod ?? 26;
    this.params.trendEMAPeriod = this.params.trendEMAPeriod ?? 50;
    this.params.macdFastPeriod = this.params.macdFastPeriod ?? 12;
    this.params.macdSlowPeriod = this.params.macdSlowPeriod ?? 26;
    this.params.macdSignalPeriod = this.params.macdSignalPeriod ?? 9;
    this.params.adxPeriod = this.params.adxPeriod ?? 14;
    this.params.adxMinThreshold = this.params.adxMinThreshold ?? 25;
    this.params.enableADXFilter = this.params.enableADXFilter ?? true;
    this.params.atrPeriod = this.params.atrPeriod ?? 14;
    this.params.atrStopMultiplier = this.params.atrStopMultiplier ?? 2.0;
    this.params.atrTrailMultiplier = this.params.atrTrailMultiplier ?? 3.0;
    this.params.volumeMAPeriod = this.params.volumeMAPeriod ?? 20;
    this.params.volumeSpikeMultiplier = this.params.volumeSpikeMultiplier ?? 1.2;
    this.params.enableVolumeFilter = this.params.enableVolumeFilter ?? true;
    this.params.positionSizePercent = this.params.positionSizePercent ?? 7;
    this.params.stopLossPercent = this.params.stopLossPercent ?? 5;
    this.params.confirmationCandles = this.params.confirmationCandles ?? 2;
    this.params.maxHoldCandles = this.params.maxHoldCandles ?? 192;
    this.params.cooldownCandles = this.params.cooldownCandles ?? 5;
  }

  async initialize(): Promise<void> {
    await super.initialize();

    const savedState = this.getState();
    if (savedState.customState?.trend) {
      this.trendState = savedState.customState.trend;
    }

    this.log('info', 'EMA+MACD+ADX Trend Strategy v2 initialized', {
      symbol: this.config.symbol,
      fastEMA: this.params.fastEMAPeriod,
      slowEMA: this.params.slowEMAPeriod,
      trendEMA: this.params.trendEMAPeriod,
      adxMinThreshold: this.params.adxMinThreshold,
      enableADXFilter: this.params.enableADXFilter,
      enableVolumeFilter: this.params.enableVolumeFilter,
      positionSizePercent: this.params.positionSizePercent,
    });
  }

  async onCandle(candle: Candle): Promise<Signal[]> {
    if (!this.isActive()) {
      return [];
    }

    const signals: Signal[] = [];

    // Calculate max history needed
    const maxHistory = Math.max(
      this.params.trendEMAPeriod + 20,
      this.params.macdSlowPeriod + this.params.macdSignalPeriod + 20,
      this.params.adxPeriod * 3 + 10,
      this.params.atrPeriod * 2 + 10,
      this.params.volumeMAPeriod + 10
    );

    addCandle(this.trendState.history, candle, maxHistory);

    // Increment counters
    this.trendState.candlesSinceLastTrade++;
    if (this.trendState.inPosition) {
      this.trendState.candlesInPosition++;
      this.trendState.highestPriceSinceEntry = Math.max(
        this.trendState.highestPriceSinceEntry,
        candle.high
      );
    }

    const { closes, volumes } = this.trendState.history;

    // Need enough data for all indicators
    const minDataNeeded = Math.max(
      this.params.trendEMAPeriod,
      this.params.macdSlowPeriod + this.params.macdSignalPeriod
    );
    if (closes.length < minDataNeeded) {
      return [];
    }

    // ============================================================
    // Calculate all indicators
    // ============================================================

    const currentPrice = candle.close;

    // EMAs
    const fastEMAValues = calculateEMA(closes, this.params.fastEMAPeriod);
    const slowEMAValues = calculateEMA(closes, this.params.slowEMAPeriod);
    const currentFastEMA = fastEMAValues.length > 0 ? fastEMAValues[fastEMAValues.length - 1] : null;
    const currentSlowEMA = slowEMAValues.length > 0 ? slowEMAValues[slowEMAValues.length - 1] : null;
    const currentTrendEMA = getLatestEMA(closes, this.params.trendEMAPeriod);

    // MACD
    const macdValues = calculateMACD(
      closes,
      this.params.macdFastPeriod,
      this.params.macdSlowPeriod,
      this.params.macdSignalPeriod
    );
    const currentMACD = macdValues.length > 0 ? macdValues[macdValues.length - 1] : null;
    const previousMACD = macdValues.length > 1 ? macdValues[macdValues.length - 2] : null;

    // ADX
    const currentADX = this.params.enableADXFilter
      ? getLatestADX(this.trendState.history, this.params.adxPeriod)
      : null;

    // ATR
    const currentATR = getLatestATR(this.trendState.history, this.params.atrPeriod);

    // Skip if critical indicators aren't ready
    if (currentFastEMA === null || currentSlowEMA === null || currentMACD === null) {
      return [];
    }

    // ============================================================
    // ENTRY CONDITIONS
    // ============================================================

    // 1. ADX regime filter: strong trend required
    let adxPass = true;
    let bullishDI = true;
    if (this.params.enableADXFilter && currentADX !== null) {
      adxPass = currentADX.adx >= this.params.adxMinThreshold;
      bullishDI = currentADX.plusDI > currentADX.minusDI;
    }

    // 2. EMA alignment: fast > slow, price > trend EMA
    const emaAligned = currentFastEMA > currentSlowEMA;
    const aboveTrendEMA = currentTrendEMA !== null ? currentPrice > currentTrendEMA : true;

    // 3. MACD confirmation: line > signal, histogram positive and increasing
    const macdBullish = currentMACD.macd > currentMACD.signal;
    const histogramIncreasing = previousMACD !== null
      ? currentMACD.histogram > previousMACD.histogram
      : false;

    // 4. Volume confirmation
    let volumePass = true;
    if (this.params.enableVolumeFilter) {
      volumePass = isVolumeSpike(
        volumes,
        this.params.volumeMAPeriod,
        this.params.volumeSpikeMultiplier
      );
    }

    // 5. Cooldown
    const cooldownPass = this.trendState.candlesSinceLastTrade >= this.params.cooldownCandles;

    // ALL conditions must be true for entry
    if (
      adxPass &&
      bullishDI &&
      emaAligned &&
      aboveTrendEMA &&
      macdBullish &&
      histogramIncreasing &&
      volumePass &&
      cooldownPass &&
      !this.trendState.inPosition
    ) {
      const quantity = this.calculatePositionSize(currentPrice);

      // Dynamic stop loss: ATR-based
      const stopLoss = currentATR !== null
        ? currentPrice - currentATR * this.params.atrStopMultiplier
        : currentPrice * (1 - this.params.stopLossPercent / 100);

      // No fixed take profit — we use trailing stop to let winners run
      const buySignal = this.createSignal(
        'buy',
        quantity,
        undefined, // Market order
        stopLoss,
        undefined, // No fixed TP — trailing stop handles exit
        `Trend Buy: ADX=${currentADX?.adx.toFixed(1) ?? 'N/A'}, ` +
        `+DI=${currentADX?.plusDI.toFixed(1) ?? 'N/A'}, ` +
        `MACD=${currentMACD.macd.toFixed(4)}, ` +
        `EMA${this.params.fastEMAPeriod}>${this.params.slowEMAPeriod}`
      );

      signals.push(buySignal);

      // Update state
      this.trendState.inPosition = true;
      this.trendState.entryPrice = currentPrice;
      this.trendState.entryTime = candle.timestamp;
      this.trendState.positionQuantity = quantity;
      this.trendState.highestPriceSinceEntry = candle.high;
      this.trendState.candlesInPosition = 0;
      this.trendState.candlesBelowSlowEMA = 0;
      this.trendState.candlesSinceLastTrade = 0;

      // Set initial trailing stop
      this.trendState.trailingStopPrice = currentATR !== null
        ? currentPrice - currentATR * this.params.atrTrailMultiplier
        : currentPrice * (1 - this.params.stopLossPercent / 100);

      this.log('info', 'BUY signal generated (Trend)', {
        price: currentPrice,
        adx: currentADX?.adx.toFixed(1) ?? 'N/A',
        plusDI: currentADX?.plusDI.toFixed(1) ?? 'N/A',
        minusDI: currentADX?.minusDI.toFixed(1) ?? 'N/A',
        macd: currentMACD.macd.toFixed(4),
        macdSignal: currentMACD.signal.toFixed(4),
        histogram: currentMACD.histogram.toFixed(4),
        fastEMA: currentFastEMA.toFixed(2),
        slowEMA: currentSlowEMA.toFixed(2),
        trendEMA: currentTrendEMA?.toFixed(2) ?? 'N/A',
        atr: currentATR?.toFixed(2) ?? 'N/A',
        stopLoss: stopLoss.toFixed(2),
        quantity: quantity.toFixed(6),
      });
    }

    // ============================================================
    // EXIT CONDITIONS (when in position)
    // ============================================================

    if (this.trendState.inPosition) {
      // Update trailing stop based on highest price since entry
      if (currentATR !== null) {
        const newTrailingStop = this.trendState.highestPriceSinceEntry -
          currentATR * this.params.atrTrailMultiplier;
        this.trendState.trailingStopPrice = Math.max(
          this.trendState.trailingStopPrice,
          newTrailingStop
        );
      }

      const profitPercent = percentChange(this.trendState.entryPrice, currentPrice);

      // Exit conditions
      const macdBearishCross = currentMACD.macd < currentMACD.signal;
      const adxWeakening = this.params.enableADXFilter && currentADX !== null
        ? currentADX.adx < 20
        : false;
      const trailingStopHit = currentPrice <= this.trendState.trailingStopPrice;
      const fixedStopHit = currentPrice <= this.trendState.entryPrice * (1 - this.params.stopLossPercent / 100);
      const maxHoldReached = this.trendState.candlesInPosition >= this.params.maxHoldCandles;

      // Track consecutive candles below slow EMA
      if (currentSlowEMA !== null && currentPrice < currentSlowEMA) {
        this.trendState.candlesBelowSlowEMA++;
      } else {
        this.trendState.candlesBelowSlowEMA = 0;
      }
      const belowSlowEMATooLong = this.trendState.candlesBelowSlowEMA >= this.params.confirmationCandles;

      // Any exit condition triggers sell
      if (
        macdBearishCross ||
        adxWeakening ||
        trailingStopHit ||
        fixedStopHit ||
        belowSlowEMATooLong ||
        maxHoldReached
      ) {
        let reason = '';
        if (trailingStopHit) reason = 'Trailing stop hit';
        else if (fixedStopHit) reason = 'Fixed stop loss hit';
        else if (macdBearishCross) reason = 'MACD bearish crossover';
        else if (adxWeakening) reason = `ADX weakening (${currentADX?.adx.toFixed(1)})`;
        else if (belowSlowEMATooLong) reason = `Price below EMA${this.params.slowEMAPeriod} for ${this.params.confirmationCandles} candles`;
        else if (maxHoldReached) reason = `Max hold (${this.params.maxHoldCandles} candles)`;

        const sellSignal = this.createSignal(
          'sell',
          this.trendState.positionQuantity,
          undefined,
          undefined,
          undefined,
          `Trend Exit: ${reason} (${profitPercent.toFixed(2)}% profit)`
        );

        signals.push(sellSignal);

        this.log('info', 'SELL signal generated (Trend)', {
          price: currentPrice,
          entryPrice: this.trendState.entryPrice.toFixed(2),
          profitPercent: profitPercent.toFixed(2),
          reason,
          holdCandles: this.trendState.candlesInPosition,
          highestPrice: this.trendState.highestPriceSinceEntry.toFixed(2),
        });

        // Reset state
        this.trendState.inPosition = false;
        this.trendState.entryPrice = 0;
        this.trendState.entryTime = 0;
        this.trendState.trailingStopPrice = 0;
        this.trendState.highestPriceSinceEntry = 0;
        this.trendState.positionQuantity = 0;
        this.trendState.candlesBelowSlowEMA = 0;
        this.trendState.candlesInPosition = 0;
        this.trendState.candlesSinceLastTrade = 0;
      }
    }

    // Store previous MACD histogram for next candle
    this.trendState.previousMACDHistogram = currentMACD.histogram;

    // ============================================================
    // Update state for persistence
    // ============================================================

    this.setState({
      lastProcessedCandle: candle.timestamp,
      indicators: {
        fastEMA: currentFastEMA,
        slowEMA: currentSlowEMA,
        trendEMA: currentTrendEMA,
        macd: currentMACD.macd,
        macdSignal: currentMACD.signal,
        macdHistogram: currentMACD.histogram,
        adx: currentADX?.adx ?? null,
        plusDI: currentADX?.plusDI ?? null,
        minusDI: currentADX?.minusDI ?? null,
        atr: currentATR,
      },
      customState: { trend: this.trendState },
    });

    return signals;
  }

  async onOrderFilled(order: Order): Promise<void> {
    await super.onOrderFilled(order);

    if (order.side === 'buy') {
      this.trendState.inPosition = true;
      this.trendState.entryPrice = order.averageFillPrice;
      this.trendState.entryTime = order.filledAt?.getTime() || Date.now();
      this.trendState.positionQuantity = order.filledQuantity;
      this.trendState.highestPriceSinceEntry = order.averageFillPrice;

      this.log('info', 'Trend position opened', {
        entryPrice: this.trendState.entryPrice.toFixed(2),
        quantity: order.filledQuantity.toFixed(6),
      });
    } else if (order.side === 'sell') {
      const profit = (order.averageFillPrice - this.trendState.entryPrice) * order.filledQuantity;

      this.log('info', 'Trend position closed', {
        exitPrice: order.averageFillPrice.toFixed(2),
        profit: profit.toFixed(2),
      });

      this.trendState.inPosition = false;
      this.trendState.entryPrice = 0;
      this.trendState.trailingStopPrice = 0;
      this.trendState.highestPriceSinceEntry = 0;
      this.trendState.positionQuantity = 0;
    }
  }

  /**
   * Calculate position size based on risk parameters
   */
  private calculatePositionSize(currentPrice: number): number {
    const capital = this.config.currentCapital;
    const positionSizePercent = this.params.positionSizePercent || 7;

    const positionValue = capital * (positionSizePercent / 100);
    return positionValue / currentPrice;
  }

  /**
   * Get current indicator values (for monitoring)
   */
  getIndicators(): {
    fastEMA: number | null;
    slowEMA: number | null;
    trendEMA: number | null;
    macd: number | null;
    macdSignal: number | null;
    macdHistogram: number | null;
    adx: number | null;
    atr: number | null;
    inPosition: boolean;
    entryPrice: number;
    candlesInPosition: number;
  } {
    const state = this.getState();
    const indicators = state.indicators || {};

    return {
      fastEMA: indicators.fastEMA ?? null,
      slowEMA: indicators.slowEMA ?? null,
      trendEMA: indicators.trendEMA ?? null,
      macd: indicators.macd ?? null,
      macdSignal: indicators.macdSignal ?? null,
      macdHistogram: indicators.macdHistogram ?? null,
      adx: indicators.adx ?? null,
      atr: indicators.atr ?? null,
      inPosition: this.trendState.inPosition,
      entryPrice: this.trendState.entryPrice,
      candlesInPosition: this.trendState.candlesInPosition,
    };
  }
}
