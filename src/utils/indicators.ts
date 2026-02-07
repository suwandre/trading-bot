/**
 * Shared Indicator Utilities
 * Centralized indicator calculations using real OHLC data
 * Used by all strategies to avoid duplicating indicator logic
 */

import type { Candle } from '../types';
import { RSI, BollingerBands, SMA, EMA, MACD, ADX } from 'technicalindicators';

// ============================================================
// OHLC History Manager
// ============================================================

export interface OHLCHistory {
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
  timestamps: number[];
}

/**
 * Create an empty OHLC history
 */
export function createOHLCHistory(): OHLCHistory {
  return {
    opens: [],
    highs: [],
    lows: [],
    closes: [],
    volumes: [],
    timestamps: [],
  };
}

/**
 * Add a candle to OHLC history and trim to maxLength
 */
export function addCandle(history: OHLCHistory, candle: Candle, maxLength: number): void {
  history.opens.push(candle.open);
  history.highs.push(candle.high);
  history.lows.push(candle.low);
  history.closes.push(candle.close);
  history.volumes.push(candle.volume);
  history.timestamps.push(candle.timestamp);

  if (history.closes.length > maxLength) {
    const excess = history.closes.length - maxLength;
    history.opens.splice(0, excess);
    history.highs.splice(0, excess);
    history.lows.splice(0, excess);
    history.closes.splice(0, excess);
    history.volumes.splice(0, excess);
    history.timestamps.splice(0, excess);
  }
}

// ============================================================
// ATR (Average True Range) — Real OHLC-based
// ============================================================

/**
 * Calculate ATR using real high/low/close data
 * Returns array of ATR values (length = data.length - period)
 */
export function calculateATR(history: OHLCHistory, period: number): number[] {
  const { highs, lows, closes } = history;

  if (closes.length < period + 1) {
    return [];
  }

  // Calculate True Range for each bar (starting from index 1)
  const trueRanges: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }

  // Calculate ATR using Wilder's smoothing (exponential)
  const atrValues: number[] = [];
  
  // First ATR is simple average of first `period` true ranges
  let atr = trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;
  atrValues.push(atr);

  // Subsequent ATRs use Wilder's smoothing
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    atrValues.push(atr);
  }

  return atrValues;
}

/**
 * Get the latest ATR value
 */
export function getLatestATR(history: OHLCHistory, period: number): number | null {
  const atrValues = calculateATR(history, period);
  return atrValues.length > 0 ? atrValues[atrValues.length - 1] : null;
}

// ============================================================
// ADX (Average Directional Index) with +DI/-DI
// ============================================================

export interface ADXResult {
  adx: number;
  plusDI: number;
  minusDI: number;
}

/**
 * Calculate ADX with +DI and -DI using real OHLC data
 * Returns array of ADX results
 */
export function calculateADX(history: OHLCHistory, period: number): ADXResult[] {
  const { highs, lows, closes } = history;

  if (closes.length < period * 2 + 1) {
    return [];
  }

  const adxResult = ADX.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: period,
  });

  return adxResult.map((r) => ({
    adx: r.adx,
    plusDI: r.pdi,
    minusDI: r.mdi,
  }));
}

/**
 * Get the latest ADX result
 */
export function getLatestADX(history: OHLCHistory, period: number): ADXResult | null {
  const results = calculateADX(history, period);
  return results.length > 0 ? results[results.length - 1] : null;
}

// ============================================================
// Volume Analysis
// ============================================================

/**
 * Calculate average volume over a period
 */
export function calculateVolumeMA(volumes: number[], period: number): number | null {
  if (volumes.length < period) {
    return null;
  }

  const recentVolumes = volumes.slice(-period);
  return recentVolumes.reduce((sum, v) => sum + v, 0) / period;
}

/**
 * Check if current volume is a spike (above multiplier * average)
 */
export function isVolumeSpike(
  volumes: number[],
  period: number,
  multiplier: number
): boolean {
  if (volumes.length < period + 1) {
    return false;
  }

  // Average volume excluding the current bar
  const avgVolume = calculateVolumeMA(volumes.slice(0, -1), period);
  if (avgVolume === null || avgVolume === 0) {
    return false;
  }

  const currentVolume = volumes[volumes.length - 1];
  return currentVolume >= avgVolume * multiplier;
}

/**
 * Get volume ratio (current / average)
 */
export function getVolumeRatio(volumes: number[], period: number): number | null {
  if (volumes.length < period + 1) {
    return null;
  }

  const avgVolume = calculateVolumeMA(volumes.slice(0, -1), period);
  if (avgVolume === null || avgVolume === 0) {
    return null;
  }

  return volumes[volumes.length - 1] / avgVolume;
}

// ============================================================
// RSI
// ============================================================

/**
 * Calculate RSI values
 */
export function calculateRSI(closes: number[], period: number): number[] {
  if (closes.length < period + 1) {
    return [];
  }

  return RSI.calculate({
    period,
    values: closes,
  });
}

/**
 * Get the latest RSI value
 */
export function getLatestRSI(closes: number[], period: number): number | null {
  const values = calculateRSI(closes, period);
  return values.length > 0 ? values[values.length - 1] : null;
}

// ============================================================
// Bollinger Bands
// ============================================================

export interface BBResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number; // (upper - lower) / middle — measures volatility
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBB(closes: number[], period: number, stdDev: number): BBResult[] {
  if (closes.length < period) {
    return [];
  }

  const bbValues = BollingerBands.calculate({
    period,
    stdDev,
    values: closes,
  });

  return bbValues.map((b) => ({
    upper: b.upper,
    middle: b.middle,
    lower: b.lower,
    bandwidth: b.middle > 0 ? (b.upper - b.lower) / b.middle : 0,
  }));
}

/**
 * Get the latest Bollinger Bands values
 */
export function getLatestBB(closes: number[], period: number, stdDev: number): BBResult | null {
  const values = calculateBB(closes, period, stdDev);
  return values.length > 0 ? values[values.length - 1] : null;
}

// ============================================================
// Moving Averages
// ============================================================

/**
 * Calculate SMA
 */
export function calculateSMA(values: number[], period: number): number[] {
  if (values.length < period) {
    return [];
  }

  return SMA.calculate({ period, values });
}

/**
 * Calculate EMA
 */
export function calculateEMA(values: number[], period: number): number[] {
  if (values.length < period) {
    return [];
  }

  return EMA.calculate({ period, values });
}

/**
 * Get latest SMA value
 */
export function getLatestSMA(values: number[], period: number): number | null {
  const sma = calculateSMA(values, period);
  return sma.length > 0 ? sma[sma.length - 1] : null;
}

/**
 * Get latest EMA value
 */
export function getLatestEMA(values: number[], period: number): number | null {
  const ema = calculateEMA(values, period);
  return ema.length > 0 ? ema[ema.length - 1] : null;
}

// ============================================================
// MACD
// ============================================================

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
}

/**
 * Calculate MACD
 */
export function calculateMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult[] {
  if (closes.length < slowPeriod + signalPeriod) {
    return [];
  }

  const macdValues = MACD.calculate({
    values: closes,
    fastPeriod,
    slowPeriod,
    signalPeriod,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  return macdValues
    .filter((m) => m.MACD !== undefined && m.signal !== undefined && m.histogram !== undefined)
    .map((m) => ({
      macd: m.MACD!,
      signal: m.signal!,
      histogram: m.histogram!,
    }));
}

/**
 * Get latest MACD values
 */
export function getLatestMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult | null {
  const values = calculateMACD(closes, fastPeriod, slowPeriod, signalPeriod);
  return values.length > 0 ? values[values.length - 1] : null;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Calculate percentage change between two values
 */
export function percentChange(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}

/**
 * Find the highest value in the last N elements
 */
export function recentHigh(values: number[], lookback: number): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-lookback);
  return Math.max(...slice);
}

/**
 * Find the lowest value in the last N elements
 */
export function recentLow(values: number[], lookback: number): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-lookback);
  return Math.min(...slice);
}

/**
 * Check if a crossover occurred (value1 crossed above value2)
 */
export function crossedAbove(
  current1: number,
  previous1: number,
  current2: number,
  previous2: number
): boolean {
  return previous1 <= previous2 && current1 > current2;
}

/**
 * Check if a crossunder occurred (value1 crossed below value2)
 */
export function crossedBelow(
  current1: number,
  previous1: number,
  current2: number,
  previous2: number
): boolean {
  return previous1 >= previous2 && current1 < current2;
}
