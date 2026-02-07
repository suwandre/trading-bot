/**
 * Smart DCA (Dollar Cost Averaging) Strategy (v2 — Improved)
 *
 * Strategy Overview:
 * - Invests a fixed amount at regular intervals (classic DCA)
 * - Market awareness: pauses buying during crashes (RSI < 25 AND price < SMA200 * 0.9)
 * - Dip buying: buys extra when RSI is oversold (enhanced entries)
 * - Scaled average-down: buys more at deeper dips (1x at -5%, 1.5x at -10%, 2x at -15%)
 * - Partial take profit: sells 50% at target, trails remaining with trailing stop
 * - Investment cap: stops buying after maxTotalInvestment
 *
 * Key improvements over v1:
 * - Crash detection pauses buying (avoids catching falling knives)
 * - Dip buying with RSI confirmation
 * - Scaled average-down amounts
 * - Partial take profit instead of all-or-nothing
 * - Trailing stop on remaining position
 * - Max investment cap
 *
 * Best for: Long-term accumulation with smart timing
 * Timeframe: 1h - 1d
 */

import { BaseStrategy } from '../base/base-strategy';
import type { Candle, Signal, Order, DCAStrategyParams } from '../../types';
import {
  createOHLCHistory,
  addCandle,
  getLatestRSI,
  getLatestSMA,
  percentChange,
  type OHLCHistory,
} from '../../utils/indicators';

interface DCAState {
  history: OHLCHistory;
  lastInvestmentTime: number;
  totalInvested: number;
  averageEntryPrice: number;
  investmentCount: number;
  averageDownCount: number;
  totalQuantity: number;
  highestPriceSinceEntry: number;
  hasPartiallyExited: boolean;
  trailingStopPrice: number;
  isCrashMode: boolean;
}

export class DCAStrategy extends BaseStrategy {
  private dcaState: DCAState = {
    history: createOHLCHistory(),
    lastInvestmentTime: 0,
    totalInvested: 0,
    averageEntryPrice: 0,
    investmentCount: 0,
    averageDownCount: 0,
    totalQuantity: 0,
    highestPriceSinceEntry: 0,
    hasPartiallyExited: false,
    trailingStopPrice: 0,
    isCrashMode: false,
  };

  private params: DCAStrategyParams;

  constructor(config: any) {
    super(config);
    this.params = config.parameters as DCAStrategyParams;

    // Set defaults
    this.params.investmentAmount = this.params.investmentAmount ?? 100;
    this.params.interval = this.params.interval ?? 'daily';
    this.params.takeProfitPercent = this.params.takeProfitPercent ?? 5;
    this.params.averageDown = this.params.averageDown ?? true;
    this.params.averageDownPercent = this.params.averageDownPercent ?? 5;
    this.params.maxAverageDowns = this.params.maxAverageDowns ?? 3;
    this.params.averageDownScaling = this.params.averageDownScaling ?? 1.5;
    this.params.enableCrashDetection = this.params.enableCrashDetection ?? true;
    this.params.crashRSIPeriod = this.params.crashRSIPeriod ?? 14;
    this.params.crashRSIThreshold = this.params.crashRSIThreshold ?? 25;
    this.params.crashSMAPeriod = this.params.crashSMAPeriod ?? 200;
    this.params.crashSMADropPercent = this.params.crashSMADropPercent ?? 10;
    this.params.enablePartialTakeProfit = this.params.enablePartialTakeProfit ?? true;
    this.params.partialTakeProfitPercent = this.params.partialTakeProfitPercent ?? 50;
    this.params.trailingStopPercent = this.params.trailingStopPercent ?? 2;
    this.params.maxTotalInvestment = this.params.maxTotalInvestment ?? 0;
    this.params.enableDipBuying = this.params.enableDipBuying ?? true;
    this.params.dipRSIThreshold = this.params.dipRSIThreshold ?? 35;
    this.params.dipBuyMultiplier = this.params.dipBuyMultiplier ?? 1.5;
  }

  async initialize(): Promise<void> {
    await super.initialize();

    const savedState = this.getState();
    if (savedState.customState?.dca) {
      this.dcaState = savedState.customState.dca;
    }

    this.log('info', 'Smart DCA Strategy v2 initialized', {
      symbol: this.config.symbol,
      investmentAmount: this.params.investmentAmount,
      interval: this.params.interval,
      takeProfitPercent: this.params.takeProfitPercent,
      enableCrashDetection: this.params.enableCrashDetection,
      enablePartialTakeProfit: this.params.enablePartialTakeProfit,
      enableDipBuying: this.params.enableDipBuying,
    });
  }

  async onCandle(candle: Candle): Promise<Signal[]> {
    if (!this.isActive()) {
      return [];
    }

    const signals: Signal[] = [];

    // Max history needed for SMA200
    const maxHistory = Math.max(
      (this.params.crashSMAPeriod || 200) + 10,
      (this.params.crashRSIPeriod || 14) + 10
    );

    addCandle(this.dcaState.history, candle, maxHistory);

    const { closes } = this.dcaState.history;
    const currentPrice = candle.close;

    // Track highest price since entry (for trailing stop)
    if (this.dcaState.totalQuantity > 0) {
      this.dcaState.highestPriceSinceEntry = Math.max(
        this.dcaState.highestPriceSinceEntry,
        candle.high
      );
    }

    // ============================================================
    // Calculate indicators for crash detection
    // ============================================================

    const currentRSI = getLatestRSI(closes, this.params.crashRSIPeriod);
    const currentSMA = getLatestSMA(closes, this.params.crashSMAPeriod);

    // ============================================================
    // Crash Detection
    // ============================================================

    if (this.params.enableCrashDetection && currentRSI !== null && currentSMA !== null) {
      const smaDropLevel = currentSMA * (1 - this.params.crashSMADropPercent / 100);
      const isCrashing = currentRSI < this.params.crashRSIThreshold && currentPrice < smaDropLevel;

      if (isCrashing && !this.dcaState.isCrashMode) {
        this.log('warn', 'CRASH DETECTED — pausing DCA buys', {
          rsi: currentRSI.toFixed(1),
          price: currentPrice.toFixed(2),
          sma: currentSMA.toFixed(2),
          smaDropLevel: smaDropLevel.toFixed(2),
        });
        this.dcaState.isCrashMode = true;
      } else if (!isCrashing && this.dcaState.isCrashMode) {
        this.log('info', 'Crash mode ended — resuming DCA buys', {
          rsi: currentRSI.toFixed(1),
          price: currentPrice.toFixed(2),
        });
        this.dcaState.isCrashMode = false;
      }
    }

    // ============================================================
    // Emergency crash exit — sell everything if in crash with position
    // ============================================================

    if (
      this.dcaState.isCrashMode &&
      this.dcaState.totalQuantity > 0 &&
      currentRSI !== null &&
      currentRSI < this.params.crashRSIThreshold &&
      currentSMA !== null &&
      currentPrice < currentSMA * (1 - this.params.crashSMADropPercent * 1.5 / 100) // 1.5x the crash threshold
    ) {
      // Severe crash — exit position to protect capital
      const profitPercent = percentChange(this.dcaState.averageEntryPrice, currentPrice);

      const crashExitSignal = this.createSignal(
        'sell',
        this.dcaState.totalQuantity,
        undefined,
        undefined,
        undefined,
        `DCA Crash Exit: RSI=${currentRSI.toFixed(1)}, Price far below SMA (${profitPercent.toFixed(2)}% PnL)`
      );

      signals.push(crashExitSignal);

      this.log('warn', 'CRASH EXIT — selling all DCA positions', {
        price: currentPrice.toFixed(2),
        avgEntry: this.dcaState.averageEntryPrice.toFixed(2),
        profitPercent: profitPercent.toFixed(2),
        totalQuantity: this.dcaState.totalQuantity.toFixed(6),
      });

      this.resetState();
      this.updatePersistedState(candle);
      return signals;
    }

    // ============================================================
    // Regular DCA Buy
    // ============================================================

    const investmentCapReached = this.params.maxTotalInvestment > 0 &&
      this.dcaState.totalInvested >= this.params.maxTotalInvestment;

    if (
      this.shouldInvest(candle.timestamp) &&
      !this.dcaState.isCrashMode &&
      !investmentCapReached
    ) {
      let buyAmount = this.params.investmentAmount;

      // Dip buying: increase amount when RSI is oversold
      if (
        this.params.enableDipBuying &&
        currentRSI !== null &&
        currentRSI < this.params.dipRSIThreshold
      ) {
        buyAmount *= this.params.dipBuyMultiplier;
        this.log('info', 'Dip buy enhancement active', {
          rsi: currentRSI.toFixed(1),
          originalAmount: this.params.investmentAmount,
          enhancedAmount: buyAmount.toFixed(2),
        });
      }

      // Cap at max investment
      if (this.params.maxTotalInvestment > 0) {
        const remaining = this.params.maxTotalInvestment - this.dcaState.totalInvested;
        buyAmount = Math.min(buyAmount, remaining);
      }

      if (buyAmount > 0) {
        const quantity = buyAmount / currentPrice;

        const buySignal = this.createSignal(
          'buy',
          quantity,
          undefined,
          undefined,
          undefined,
          `DCA Buy #${this.dcaState.investmentCount + 1}: $${buyAmount.toFixed(2)} at ${currentPrice.toFixed(2)}`
        );

        signals.push(buySignal);

        // Update state
        this.dcaState.lastInvestmentTime = candle.timestamp;
        this.dcaState.investmentCount++;

        this.log('info', 'Regular DCA buy signal', {
          price: currentPrice.toFixed(2),
          amount: buyAmount.toFixed(2),
          quantity: quantity.toFixed(6),
          investmentCount: this.dcaState.investmentCount,
        });
      }
    }

    // ============================================================
    // Average Down (scaled)
    // ============================================================

    if (
      this.params.averageDown &&
      !this.dcaState.isCrashMode &&
      !investmentCapReached &&
      this.shouldAverageDown(currentPrice)
    ) {
      // Scale the buy amount based on how deep the dip is
      const dropPercent = Math.abs(
        percentChange(this.dcaState.averageEntryPrice, currentPrice)
      );
      const scaleFactor = Math.pow(
        this.params.averageDownScaling,
        this.dcaState.averageDownCount
      );
      let avgDownAmount = this.params.investmentAmount * scaleFactor;

      // Cap at max investment
      if (this.params.maxTotalInvestment > 0) {
        const remaining = this.params.maxTotalInvestment - this.dcaState.totalInvested;
        avgDownAmount = Math.min(avgDownAmount, remaining);
      }

      if (avgDownAmount > 0) {
        const quantity = avgDownAmount / currentPrice;

        const avgDownSignal = this.createSignal(
          'buy',
          quantity,
          undefined,
          undefined,
          undefined,
          `DCA Avg Down #${this.dcaState.averageDownCount + 1}: ` +
          `$${avgDownAmount.toFixed(2)} at ${currentPrice.toFixed(2)} ` +
          `(${dropPercent.toFixed(1)}% below avg entry, ${scaleFactor.toFixed(1)}x scaling)`
        );

        signals.push(avgDownSignal);
        this.dcaState.averageDownCount++;

        this.log('info', 'Average down signal', {
          price: currentPrice.toFixed(2),
          amount: avgDownAmount.toFixed(2),
          dropPercent: dropPercent.toFixed(1),
          scaleFactor: scaleFactor.toFixed(1),
          averageDownCount: this.dcaState.averageDownCount,
        });
      }
    }

    // ============================================================
    // Take Profit Logic
    // ============================================================

    if (this.dcaState.totalQuantity > 0 && this.dcaState.averageEntryPrice > 0) {
      const profitPercent = percentChange(this.dcaState.averageEntryPrice, currentPrice);

      // ---- Partial Take Profit ----
      if (
        this.params.enablePartialTakeProfit &&
        !this.dcaState.hasPartiallyExited &&
        profitPercent >= this.params.takeProfitPercent
      ) {
        const partialQuantity = this.dcaState.totalQuantity *
          (this.params.partialTakeProfitPercent / 100);

        const partialSellSignal = this.createSignal(
          'sell',
          partialQuantity,
          undefined,
          undefined,
          undefined,
          `DCA Partial TP (${this.params.partialTakeProfitPercent}%): ` +
          `${profitPercent.toFixed(2)}% profit at ${currentPrice.toFixed(2)}`
        );

        signals.push(partialSellSignal);
        this.dcaState.hasPartiallyExited = true;

        // Set trailing stop for remaining position
        this.dcaState.trailingStopPrice = currentPrice *
          (1 - this.params.trailingStopPercent / 100);

        this.log('info', 'DCA partial take profit', {
          price: currentPrice.toFixed(2),
          profitPercent: profitPercent.toFixed(2),
          partialQuantity: partialQuantity.toFixed(6),
          trailingStop: this.dcaState.trailingStopPrice.toFixed(2),
        });
      }

      // ---- Trailing Stop on remaining position ----
      if (this.dcaState.hasPartiallyExited && this.dcaState.totalQuantity > 0) {
        // Update trailing stop
        const newTrailingStop = currentPrice * (1 - this.params.trailingStopPercent / 100);
        this.dcaState.trailingStopPrice = Math.max(
          this.dcaState.trailingStopPrice,
          newTrailingStop
        );

        if (currentPrice <= this.dcaState.trailingStopPrice) {
          // Trailing stop hit — sell remaining
          const sellSignal = this.createSignal(
            'sell',
            this.dcaState.totalQuantity,
            undefined,
            undefined,
            undefined,
            `DCA Trailing Stop: ${profitPercent.toFixed(2)}% profit at ${currentPrice.toFixed(2)}`
          );

          signals.push(sellSignal);

          this.log('info', 'DCA trailing stop hit — selling remaining', {
            price: currentPrice.toFixed(2),
            trailingStop: this.dcaState.trailingStopPrice.toFixed(2),
            profitPercent: profitPercent.toFixed(2),
          });

          this.resetState();
        }
      }

      // ---- Full Take Profit (if partial TP is disabled) ----
      if (
        !this.params.enablePartialTakeProfit &&
        profitPercent >= this.params.takeProfitPercent
      ) {
        const sellSignal = this.createSignal(
          'sell',
          this.dcaState.totalQuantity,
          undefined,
          undefined,
          undefined,
          `DCA Full TP: ${profitPercent.toFixed(2)}% profit at ${currentPrice.toFixed(2)}`
        );

        signals.push(sellSignal);

        this.log('info', 'DCA full take profit', {
          price: currentPrice.toFixed(2),
          profitPercent: profitPercent.toFixed(2),
        });

        this.resetState();
      }
    }

    this.updatePersistedState(candle);
    return signals;
  }

  async onOrderFilled(order: Order): Promise<void> {
    await super.onOrderFilled(order);

    if (order.side === 'buy') {
      const investmentAmount = order.filledQuantity * order.averageFillPrice;
      this.dcaState.totalInvested += investmentAmount;
      this.dcaState.totalQuantity += order.filledQuantity;

      // Recalculate average entry price
      if (this.dcaState.totalQuantity > 0) {
        this.dcaState.averageEntryPrice = this.dcaState.totalInvested / this.dcaState.totalQuantity;
      }

      // Reset highest price tracking
      this.dcaState.highestPriceSinceEntry = Math.max(
        this.dcaState.highestPriceSinceEntry,
        order.averageFillPrice
      );

      this.log('info', 'DCA buy filled', {
        totalInvested: this.dcaState.totalInvested.toFixed(2),
        totalQuantity: this.dcaState.totalQuantity.toFixed(6),
        averageEntryPrice: this.dcaState.averageEntryPrice.toFixed(2),
      });
    } else if (order.side === 'sell') {
      // Reduce position
      this.dcaState.totalQuantity -= order.filledQuantity;
      
      // Proportionally reduce totalInvested
      const soldRatio = order.filledQuantity / (this.dcaState.totalQuantity + order.filledQuantity);
      this.dcaState.totalInvested *= (1 - soldRatio);

      if (this.dcaState.totalQuantity <= 0) {
        this.resetState();
        this.log('info', 'DCA position fully closed');
      } else {
        this.log('info', 'DCA partial sell filled', {
          remainingQuantity: this.dcaState.totalQuantity.toFixed(6),
          remainingInvested: this.dcaState.totalInvested.toFixed(2),
        });
      }
    }
  }

  /**
   * Check if it's time to make a regular investment
   */
  private shouldInvest(timestamp: number): boolean {
    if (this.dcaState.lastInvestmentTime === 0) {
      return true;
    }

    const timeSinceLastInvestment = timestamp - this.dcaState.lastInvestmentTime;
    const intervalMs = this.getIntervalMs(this.params.interval);

    return timeSinceLastInvestment >= intervalMs;
  }

  /**
   * Check if we should average down
   */
  private shouldAverageDown(currentPrice: number): boolean {
    if (!this.params.averageDown) return false;
    if (this.dcaState.averageEntryPrice === 0) return false;
    if (this.dcaState.averageDownCount >= this.params.maxAverageDowns) return false;

    const priceDropPercent = Math.abs(
      percentChange(this.dcaState.averageEntryPrice, currentPrice)
    );

    // Each average down requires a deeper drop
    const requiredDrop = this.params.averageDownPercent *
      (1 + this.dcaState.averageDownCount * 0.5); // 5%, 7.5%, 10% etc.

    return currentPrice < this.dcaState.averageEntryPrice && priceDropPercent >= requiredDrop;
  }

  /**
   * Convert interval to milliseconds
   */
  private getIntervalMs(interval: string | number): number {
    if (typeof interval === 'number') {
      return interval;
    }

    const intervals: Record<string, number> = {
      hourly: 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };

    return intervals[interval] || intervals['daily'];
  }

  /**
   * Reset DCA state after full exit
   */
  private resetState(): void {
    this.dcaState.totalInvested = 0;
    this.dcaState.averageEntryPrice = 0;
    this.dcaState.investmentCount = 0;
    this.dcaState.averageDownCount = 0;
    this.dcaState.totalQuantity = 0;
    this.dcaState.highestPriceSinceEntry = 0;
    this.dcaState.hasPartiallyExited = false;
    this.dcaState.trailingStopPrice = 0;
    // Keep lastInvestmentTime and isCrashMode
  }

  /**
   * Update persisted state
   */
  private updatePersistedState(candle: Candle): void {
    this.setState({
      lastProcessedCandle: candle.timestamp,
      indicators: {
        totalInvested: this.dcaState.totalInvested,
        averageEntryPrice: this.dcaState.averageEntryPrice,
        totalQuantity: this.dcaState.totalQuantity,
        investmentCount: this.dcaState.investmentCount,
        isCrashMode: this.dcaState.isCrashMode,
        hasPartiallyExited: this.dcaState.hasPartiallyExited,
      },
      customState: { dca: this.dcaState },
    });
  }

  /**
   * Get current DCA state (for monitoring)
   */
  getDCAState(): DCAState {
    return { ...this.dcaState };
  }
}
