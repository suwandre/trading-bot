/**
 * Adaptive Grid Trading Strategy (v2 — Replaces static Grid)
 *
 * Strategy Overview:
 * - Auto-centers grid on current price using ATR for spacing
 * - Dynamically recalculates grid when price moves outside range
 * - Only buys at the nearest grid level below price (not all at once)
 * - ADX regime filter: only trades when ADX < 20 (ranging market)
 * - Stop loss below lowest grid level
 * - Tracks profit per grid cycle
 *
 * Key improvements over v1:
 * - Adaptive grid that recenters automatically
 * - ATR-based grid spacing (adapts to volatility)
 * - Only trades nearest grid level (not all simultaneously)
 * - Stop loss protection
 * - ADX filter to avoid trending markets
 * - Max positions per side limit
 *
 * Best for: Ranging/sideways markets with stable volatility (ADX < 20)
 * Timeframe: 5m - 15m
 */

import { BaseStrategy } from '../base/base-strategy';
import type { Candle, Signal, Order, GridStrategyParams } from '../../types';
import {
  createOHLCHistory,
  addCandle,
  getLatestATR,
  getLatestADX,
  type OHLCHistory,
} from '../../utils/indicators';

interface GridLevel {
  price: number;
  quantity: number;
  hasPosition: boolean;
  buyOrderId?: string;
  buyPrice?: number; // Actual fill price
}

interface AdaptiveGridState {
  history: OHLCHistory;
  grids: GridLevel[];
  gridCenter: number;
  gridSpacing: number;
  initialized: boolean;
  totalProfit: number;
  totalTrades: number;
  winningTrades: number;
  isPaused: boolean; // Paused due to regime filter or stop loss
}

export class AdaptiveGridStrategy extends BaseStrategy {
  private gridState: AdaptiveGridState = {
    history: createOHLCHistory(),
    grids: [],
    gridCenter: 0,
    gridSpacing: 0,
    initialized: false,
    totalProfit: 0,
    totalTrades: 0,
    winningTrades: 0,
    isPaused: false,
  };

  private params: GridStrategyParams;

  constructor(config: any) {
    super(config);
    this.params = config.parameters as GridStrategyParams;

    // Set defaults
    this.params.gridLevels = this.params.gridLevels ?? 10;
    this.params.gridSpacingPercent = this.params.gridSpacingPercent ?? 1;
    this.params.useAdaptiveGrid = this.params.useAdaptiveGrid ?? true;
    this.params.atrPeriod = this.params.atrPeriod ?? 14;
    this.params.atrGridMultiplier = this.params.atrGridMultiplier ?? 0.5;
    this.params.recenterThreshold = this.params.recenterThreshold ?? 2;
    this.params.upperPrice = this.params.upperPrice ?? 0;
    this.params.lowerPrice = this.params.lowerPrice ?? 0;
    this.params.quantityPerGrid = this.params.quantityPerGrid ?? 0;
    this.params.maxPositionsPerSide = this.params.maxPositionsPerSide ?? 5;
    this.params.positionSizePercent = this.params.positionSizePercent ?? 3;
    this.params.stopLossATRMultiplier = this.params.stopLossATRMultiplier ?? 2;
    this.params.enableStopLoss = this.params.enableStopLoss ?? true;
    this.params.adxPeriod = this.params.adxPeriod ?? 14;
    this.params.adxMaxThreshold = this.params.adxMaxThreshold ?? 20;
    this.params.enableADXFilter = this.params.enableADXFilter ?? true;
    this.params.reinvestProfits = this.params.reinvestProfits ?? true;
    this.params.reinvestPercent = this.params.reinvestPercent ?? 50;
  }

  async initialize(): Promise<void> {
    await super.initialize();

    const savedState = this.getState();
    if (savedState.customState?.grid) {
      this.gridState = savedState.customState.grid;
    }

    this.log('info', 'Adaptive Grid Strategy v2 initialized', {
      symbol: this.config.symbol,
      gridLevels: this.params.gridLevels,
      useAdaptiveGrid: this.params.useAdaptiveGrid,
      adxMaxThreshold: this.params.adxMaxThreshold,
      enableADXFilter: this.params.enableADXFilter,
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
      this.params.atrPeriod * 2 + 10,
      this.params.adxPeriod * 3 + 10
    );

    addCandle(this.gridState.history, candle, maxHistory);

    const currentPrice = candle.close;

    // ============================================================
    // Calculate indicators
    // ============================================================

    const currentATR = getLatestATR(this.gridState.history, this.params.atrPeriod);
    const currentADX = this.params.enableADXFilter
      ? getLatestADX(this.gridState.history, this.params.adxPeriod)
      : null;

    // ============================================================
    // ADX Regime Filter
    // ============================================================

    if (this.params.enableADXFilter && currentADX !== null) {
      if (currentADX.adx >= this.params.adxMaxThreshold) {
        // Market is trending — pause grid
        if (!this.gridState.isPaused) {
          this.log('info', 'Grid paused: market trending', {
            adx: currentADX.adx.toFixed(1),
            threshold: this.params.adxMaxThreshold,
          });
          this.gridState.isPaused = true;
        }

        // Still check stop loss even when paused
        const stopSignals = this.checkStopLoss(currentPrice, currentATR);
        if (stopSignals.length > 0) {
          signals.push(...stopSignals);
        }

        this.updateState(candle);
        return signals;
      } else if (this.gridState.isPaused) {
        this.log('info', 'Grid resumed: market ranging', {
          adx: currentADX.adx.toFixed(1),
        });
        this.gridState.isPaused = false;
      }
    }

    // ============================================================
    // Initialize or recenter grid
    // ============================================================

    if (!this.gridState.initialized || this.shouldRecenterGrid(currentPrice)) {
      this.initializeGrid(currentPrice, currentATR);
    }

    if (!this.gridState.initialized || this.gridState.grids.length === 0) {
      this.updateState(candle);
      return [];
    }

    // ============================================================
    // Check stop loss
    // ============================================================

    const stopSignals = this.checkStopLoss(currentPrice, currentATR);
    if (stopSignals.length > 0) {
      signals.push(...stopSignals);
      this.updateState(candle);
      return signals;
    }

    // ============================================================
    // Grid trading logic — only trade nearest levels
    // ============================================================

    const openPositions = this.gridState.grids.filter(g => g.hasPosition).length;

    // Find the nearest grid level BELOW current price that doesn't have a position
    const buyGrids = this.gridState.grids
      .filter(g => !g.hasPosition && g.price < currentPrice)
      .sort((a, b) => b.price - a.price); // Highest first (nearest to price)

    // Only buy at the nearest grid level, and respect max positions
    if (buyGrids.length > 0 && openPositions < this.params.maxPositionsPerSide) {
      const nearestBuyGrid = buyGrids[0];

      // Price must have actually crossed down to this grid level
      const priceCrossedDown = candle.low <= nearestBuyGrid.price;

      if (priceCrossedDown) {
        const quantity = this.calculateGridQuantity(nearestBuyGrid.price);

        const buySignal = this.createSignal(
          'buy',
          quantity,
          nearestBuyGrid.price, // Limit order at grid price
          undefined,
          undefined,
          `Grid buy at ${nearestBuyGrid.price.toFixed(2)} ` +
          `(${openPositions + 1}/${this.params.maxPositionsPerSide} positions)`
        );

        signals.push(buySignal);

        // Mark grid as having a pending position
        nearestBuyGrid.hasPosition = true;
        nearestBuyGrid.quantity = quantity;

        this.log('info', 'Grid buy signal', {
          gridPrice: nearestBuyGrid.price.toFixed(2),
          quantity: quantity.toFixed(6),
          openPositions: openPositions + 1,
        });
      }
    }

    // Find grid levels WITH positions where price has risen to the NEXT grid above
    for (const grid of this.gridState.grids) {
      if (!grid.hasPosition) continue;

      // Find the next grid level above this one
      const gridIndex = this.gridState.grids.indexOf(grid);
      const nextGridAbove = this.gridState.grids[gridIndex + 1];

      if (nextGridAbove && currentPrice >= nextGridAbove.price) {
        // Price has risen to next grid — sell
        const sellSignal = this.createSignal(
          'sell',
          grid.quantity,
          nextGridAbove.price, // Limit order at next grid
          undefined,
          undefined,
          `Grid sell at ${nextGridAbove.price.toFixed(2)} ` +
          `(bought at ${grid.price.toFixed(2)}, profit: ${((nextGridAbove.price - grid.price) / grid.price * 100).toFixed(2)}%)`
        );

        signals.push(sellSignal);

        // Calculate profit
        const profit = (nextGridAbove.price - grid.price) * grid.quantity;
        this.gridState.totalProfit += profit;
        this.gridState.totalTrades++;
        if (profit > 0) this.gridState.winningTrades++;

        // Reset grid position
        grid.hasPosition = false;
        grid.buyOrderId = undefined;
        grid.buyPrice = undefined;

        this.log('info', 'Grid sell signal', {
          buyPrice: grid.price.toFixed(2),
          sellPrice: nextGridAbove.price.toFixed(2),
          profit: profit.toFixed(2),
          totalProfit: this.gridState.totalProfit.toFixed(2),
        });

        // Reinvest profits
        if (this.params.reinvestProfits && profit > 0) {
          this.reinvestProfit(profit);
        }
      }
    }

    this.updateState(candle);
    return signals;
  }

  /**
   * Initialize or recenter the grid around current price
   */
  private initializeGrid(currentPrice: number, currentATR: number | null): void {
    // Close any existing positions before recentering
    // (In practice, the strategy manager handles this via sell signals)

    let gridSpacing: number;

    if (this.params.useAdaptiveGrid && currentATR !== null) {
      // ATR-based grid spacing
      gridSpacing = currentATR * this.params.atrGridMultiplier;
    } else {
      // Fixed percentage spacing
      gridSpacing = currentPrice * (this.params.gridSpacingPercent / 100);
    }

    // Ensure minimum spacing
    if (gridSpacing <= 0) {
      gridSpacing = currentPrice * 0.01; // 1% fallback
    }

    const halfLevels = Math.floor(this.params.gridLevels / 2);

    // Create grid levels centered on current price
    const newGrids: GridLevel[] = [];
    for (let i = -halfLevels; i <= halfLevels; i++) {
      const price = currentPrice + i * gridSpacing;
      if (price > 0) {
        newGrids.push({
          price,
          quantity: this.calculateGridQuantity(price),
          hasPosition: false,
        });
      }
    }

    // Sort by price ascending
    newGrids.sort((a, b) => a.price - b.price);

    this.gridState.grids = newGrids;
    this.gridState.gridCenter = currentPrice;
    this.gridState.gridSpacing = gridSpacing;
    this.gridState.initialized = true;

    this.log('info', 'Grid initialized/recentered', {
      center: currentPrice.toFixed(2),
      spacing: gridSpacing.toFixed(2),
      levels: newGrids.length,
      lowestGrid: newGrids[0]?.price.toFixed(2),
      highestGrid: newGrids[newGrids.length - 1]?.price.toFixed(2),
      atrBased: this.params.useAdaptiveGrid && currentATR !== null,
    });
  }

  /**
   * Check if grid should be recentered
   */
  private shouldRecenterGrid(currentPrice: number): boolean {
    if (!this.gridState.initialized || this.gridState.gridSpacing === 0) {
      return true;
    }

    // Check if any positions are open — don't recenter with open positions
    const hasOpenPositions = this.gridState.grids.some(g => g.hasPosition);
    if (hasOpenPositions) {
      return false;
    }

    // Recenter if price has moved too far from grid center
    const distanceFromCenter = Math.abs(currentPrice - this.gridState.gridCenter);
    const threshold = this.gridState.gridSpacing * this.params.recenterThreshold;

    return distanceFromCenter > threshold;
  }

  /**
   * Check stop loss — close all positions if price drops too far
   */
  private checkStopLoss(currentPrice: number, currentATR: number | null): Signal[] {
    if (!this.params.enableStopLoss) return [];

    const openPositionGrids = this.gridState.grids.filter(g => g.hasPosition);
    if (openPositionGrids.length === 0) return [];

    // Find lowest grid with a position
    const lowestPositionGrid = openPositionGrids.reduce(
      (min, g) => g.price < min.price ? g : min,
      openPositionGrids[0]
    );

    // Stop loss level
    const stopLevel = currentATR !== null
      ? lowestPositionGrid.price - currentATR * this.params.stopLossATRMultiplier
      : lowestPositionGrid.price * 0.95; // 5% below lowest grid

    if (currentPrice <= stopLevel) {
      // Emergency close all positions
      const signals: Signal[] = [];

      for (const grid of openPositionGrids) {
        const sellSignal = this.createSignal(
          'sell',
          grid.quantity,
          undefined, // Market order for emergency exit
          undefined,
          undefined,
          `Grid STOP LOSS: Price ${currentPrice.toFixed(2)} below stop ${stopLevel.toFixed(2)}`
        );
        signals.push(sellSignal);

        // Calculate loss
        const loss = (currentPrice - grid.price) * grid.quantity;
        this.gridState.totalProfit += loss; // Will be negative
        this.gridState.totalTrades++;

        grid.hasPosition = false;
        grid.buyOrderId = undefined;
        grid.buyPrice = undefined;
      }

      this.log('warn', 'Grid STOP LOSS triggered — all positions closed', {
        currentPrice: currentPrice.toFixed(2),
        stopLevel: stopLevel.toFixed(2),
        positionsClosed: openPositionGrids.length,
      });

      // Pause grid after stop loss
      this.gridState.isPaused = true;

      return signals;
    }

    return [];
  }

  /**
   * Calculate quantity for a grid level
   */
  private calculateGridQuantity(gridPrice: number): number {
    if (this.params.quantityPerGrid > 0) {
      return this.params.quantityPerGrid;
    }

    // Calculate from position size percent
    const capital = this.config.currentCapital;
    const positionValue = capital * (this.params.positionSizePercent / 100);
    return positionValue / gridPrice;
  }

  /**
   * Reinvest profits into grid
   */
  private reinvestProfit(profit: number): void {
    const reinvestAmount = profit * (this.params.reinvestPercent / 100);
    const additionalPerGrid = reinvestAmount / this.gridState.grids.length;

    // Only increase quantity for grids without positions
    for (const grid of this.gridState.grids) {
      if (!grid.hasPosition) {
        grid.quantity += additionalPerGrid / grid.price;
      }
    }

    this.log('debug', 'Profits reinvested', {
      profit: profit.toFixed(2),
      reinvestAmount: reinvestAmount.toFixed(2),
    });
  }

  /**
   * Update persisted state
   */
  private updateState(candle: Candle): void {
    this.setState({
      lastProcessedCandle: candle.timestamp,
      indicators: {
        gridCenter: this.gridState.gridCenter,
        gridSpacing: this.gridState.gridSpacing,
        gridLevels: this.gridState.grids.length,
        openPositions: this.gridState.grids.filter(g => g.hasPosition).length,
        totalProfit: this.gridState.totalProfit,
        isPaused: this.gridState.isPaused,
      },
      customState: { grid: this.gridState },
    });
  }

  async onOrderFilled(order: Order): Promise<void> {
    await super.onOrderFilled(order);

    const grid = this.findGridByPrice(order.averageFillPrice);

    if (grid) {
      if (order.side === 'buy') {
        grid.hasPosition = true;
        grid.buyOrderId = order.id;
        grid.buyPrice = order.averageFillPrice;
        grid.quantity = order.filledQuantity;

        this.log('info', 'Grid buy filled', {
          gridPrice: grid.price.toFixed(2),
          fillPrice: order.averageFillPrice.toFixed(2),
        });
      } else if (order.side === 'sell') {
        grid.hasPosition = false;
        grid.buyOrderId = undefined;
        grid.buyPrice = undefined;

        this.log('info', 'Grid sell filled', {
          gridPrice: grid.price.toFixed(2),
          fillPrice: order.averageFillPrice.toFixed(2),
        });
      }
    }
  }

  /**
   * Find grid level by price (with tolerance)
   */
  private findGridByPrice(price: number): GridLevel | undefined {
    const tolerance = this.gridState.gridSpacing > 0
      ? this.gridState.gridSpacing * 0.3 // 30% of grid spacing
      : price * 0.02; // 2% fallback

    return this.gridState.grids.find(
      (grid) => Math.abs(grid.price - price) < tolerance
    );
  }

  /**
   * Get grid statistics (for monitoring)
   */
  getGridStats(): {
    totalGrids: number;
    activeGrids: number;
    gridCenter: number;
    gridSpacing: number;
    totalProfit: number;
    totalTrades: number;
    winRate: number;
    isPaused: boolean;
  } {
    const activeGrids = this.gridState.grids.filter(g => g.hasPosition).length;

    return {
      totalGrids: this.gridState.grids.length,
      activeGrids,
      gridCenter: this.gridState.gridCenter,
      gridSpacing: this.gridState.gridSpacing,
      totalProfit: this.gridState.totalProfit,
      totalTrades: this.gridState.totalTrades,
      winRate: this.gridState.totalTrades > 0
        ? (this.gridState.winningTrades / this.gridState.totalTrades) * 100
        : 0,
      isPaused: this.gridState.isPaused,
    };
  }
}
