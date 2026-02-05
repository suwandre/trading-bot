/**
 * Grid Trading Strategy
 * Places buy and sell orders at predefined price levels
 */

import { BaseStrategy } from '../base/base-strategy';
import type { Candle, Signal, Order, GridStrategyParams } from '../../types';

interface GridLevel {
  price: number;
  quantity: number;
  hasPosition: boolean;
  orderId?: string;
}

interface GridState {
  grids: GridLevel[];
  initialized: boolean;
  totalProfit: number;
}

export class GridStrategy extends BaseStrategy {
  private gridState: GridState = {
    grids: [],
    initialized: false,
    totalProfit: 0,
  };

  private params: GridStrategyParams;

  constructor(config: any) {
    super(config);
    this.params = config.parameters as GridStrategyParams;
  }

  async initialize(): Promise<void> {
    await super.initialize();

    // Load state if resuming
    const savedState = this.getState();
    if (savedState.customState?.grid) {
      this.gridState = savedState.customState.grid;
    } else {
      // Initialize grid levels
      this.initializeGridLevels();
    }

    this.log('info', 'Grid Strategy initialized', {
      symbol: this.config.symbol,
      gridLevels: this.params.gridLevels,
      upperPrice: this.params.upperPrice,
      lowerPrice: this.params.lowerPrice,
      quantityPerGrid: this.params.quantityPerGrid,
    });
  }

  /**
   * Initialize grid levels
   */
  private initializeGridLevels(): void {
    const { gridLevels, upperPrice, lowerPrice, quantityPerGrid } = this.params;

    // Calculate price step between grids
    const priceStep = (upperPrice - lowerPrice) / (gridLevels - 1);

    // Create grid levels from bottom to top
    for (let i = 0; i < gridLevels; i++) {
      const price = lowerPrice + priceStep * i;

      this.gridState.grids.push({
        price,
        quantity: quantityPerGrid,
        hasPosition: false,
      });
    }

    this.gridState.initialized = true;

    this.log('info', 'Grid levels initialized', {
      levels: gridLevels,
      priceStep: priceStep.toFixed(2),
      grids: this.gridState.grids.map((g) => g.price.toFixed(2)),
    });
  }

  async onCandle(candle: Candle): Promise<Signal[]> {
    if (!this.isActive() || !this.gridState.initialized) {
      return [];
    }

    const signals: Signal[] = [];
    const currentPrice = candle.close;

    // Check each grid level
    for (let i = 0; i < this.gridState.grids.length; i++) {
      const grid = this.gridState.grids[i];

      // Buy at lower grids when price drops to that level
      if (!grid.hasPosition && currentPrice <= grid.price) {
        // Only buy if we're not at the top grid
        if (i < this.gridState.grids.length - 1) {
          const nextGrid = this.gridState.grids[i + 1];

          const buySignal = this.createSignal(
            'buy',
            grid.quantity,
            grid.price, // Limit order at grid price
            undefined,
            nextGrid.price, // Take profit at next grid
            `Grid buy at level ${i + 1}/${this.gridState.grids.length} (${grid.price.toFixed(2)})`
          );

          signals.push(buySignal);

          this.log('info', 'Grid buy signal generated', {
            level: i + 1,
            price: grid.price,
            quantity: grid.quantity,
            takeProfit: nextGrid.price,
          });
        }
      }

      // Sell at upper grids when price rises to that level
      if (grid.hasPosition && currentPrice >= grid.price) {
        const sellSignal = this.createSignal(
          'sell',
          grid.quantity,
          grid.price, // Limit order at grid price
          undefined,
          undefined,
          `Grid sell at level ${i + 1}/${this.gridState.grids.length} (${grid.price.toFixed(2)})`
        );

        signals.push(sellSignal);

        this.log('info', 'Grid sell signal generated', {
          level: i + 1,
          price: grid.price,
          quantity: grid.quantity,
        });
      }
    }

    // Update state
    this.setState({
      lastProcessedCandle: candle.timestamp,
      customState: { grid: this.gridState },
    });

    return signals;
  }

  async onOrderFilled(order: Order): Promise<void> {
    await super.onOrderFilled(order);

    // Update grid state based on filled order
    const grid = this.findGridByPrice(order.averageFillPrice);

    if (grid) {
      if (order.side === 'buy') {
        // Mark grid as having position
        grid.hasPosition = true;
        grid.orderId = order.id;

        this.log('info', 'Grid buy filled', {
          gridPrice: grid.price,
          fillPrice: order.averageFillPrice,
        });
      } else if (order.side === 'sell') {
        // Mark grid as available again
        grid.hasPosition = false;
        grid.orderId = undefined;

        // Calculate profit from this grid trade
        const profit = order.filledQuantity * (order.averageFillPrice - grid.price);
        this.gridState.totalProfit += profit;

        this.log('info', 'Grid sell filled', {
          gridPrice: grid.price,
          fillPrice: order.averageFillPrice,
          profit: profit.toFixed(2),
          totalProfit: this.gridState.totalProfit.toFixed(2),
        });

        // Reinvest profits if enabled
        if (this.params.reinvestProfits && profit > 0) {
          this.reinvestProfit(profit);
        }
      }
    }
  }

  /**
   * Find grid level by price (with tolerance)
   */
  private findGridByPrice(price: number): GridLevel | undefined {
    const tolerance = 0.02; // 2% tolerance

    return this.gridState.grids.find(
      (grid) => Math.abs(grid.price - price) / grid.price < tolerance
    );
  }

  /**
   * Reinvest profits into grid
   * Increases quantity per grid proportionally
   */
  private reinvestProfit(profit: number): void {
    // Calculate how much to add to each grid
    const additionalQuantityPerGrid = profit / (this.params.upperPrice + this.params.lowerPrice) / 2;

    for (const grid of this.gridState.grids) {
      grid.quantity += additionalQuantityPerGrid;
    }

    this.log('info', 'Profits reinvested', {
      profit: profit.toFixed(2),
      additionalQuantityPerGrid: additionalQuantityPerGrid.toFixed(6),
    });
  }

  /**
   * Get current grid state (for monitoring)
   */
  getGridState(): GridState {
    return { ...this.gridState };
  }

  /**
   * Get grid statistics
   */
  getGridStats(): {
    totalGrids: number;
    activeGrids: number;
    inactiveGrids: number;
    totalProfit: number;
    averageGridPrice: number;
  } {
    const activeGrids = this.gridState.grids.filter((g) => g.hasPosition).length;
    const totalGrids = this.gridState.grids.length;
    const averageGridPrice =
      this.gridState.grids.reduce((sum, g) => sum + g.price, 0) / totalGrids;

    return {
      totalGrids,
      activeGrids,
      inactiveGrids: totalGrids - activeGrids,
      totalProfit: this.gridState.totalProfit,
      averageGridPrice,
    };
  }
}
