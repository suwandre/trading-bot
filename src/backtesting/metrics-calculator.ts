/**
 * Metrics Calculator
 * Calculates performance metrics for trading strategies
 */

import type { Trade, StrategyMetrics, EquityPoint } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('MetricsCalculator');

export class MetricsCalculator {
  constructor() {
    logger.info('Metrics Calculator initialized');
  }

  /**
   * Calculate comprehensive strategy metrics
   */
  calculateMetrics(
    strategyId: string,
    trades: Trade[],
    equity: EquityPoint[],
    initialCapital: number
  ): StrategyMetrics {
    logger.debug('Calculating metrics', {
      strategyId,
      totalTrades: trades.length,
      equityPoints: equity.length,
    });

    // Separate winning and losing trades
    const winningTrades = trades.filter((t) => t.pnl && t.pnl > 0);
    const losingTrades = trades.filter((t) => t.pnl && t.pnl < 0);

    // Calculate total P&L
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));

    // Calculate win rate
    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;

    // Calculate average win/loss
    const averageWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const averageLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

    // Calculate profit factor
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    // Calculate Sharpe ratio
    const sharpeRatio = this.calculateSharpeRatio(equity);

    // Calculate drawdown
    const { maxDrawdown, maxDrawdownPercent, currentDrawdown, currentDrawdownPercent } =
      this.calculateDrawdown(equity);

    // Calculate average trade duration
    const averageTradeDuration = this.calculateAverageTradeDuration(trades);

    const metrics: StrategyMetrics = {
      strategyId,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      totalPnL,
      totalPnLPercent: (totalPnL / initialCapital) * 100,
      averageWin,
      averageLoss,
      profitFactor,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownPercent,
      averageTradeDuration,
      currentDrawdown,
      currentDrawdownPercent,
    };

    logger.info('Metrics calculated', {
      strategyId,
      totalPnL: metrics.totalPnL.toFixed(2),
      totalPnLPercent: metrics.totalPnLPercent.toFixed(2),
      winRate: (metrics.winRate * 100).toFixed(2),
      sharpeRatio: metrics.sharpeRatio.toFixed(2),
      maxDrawdownPercent: metrics.maxDrawdownPercent.toFixed(2),
    });

    return metrics;
  }

  /**
   * Calculate Sharpe Ratio
   * Measures risk-adjusted returns
   */
  private calculateSharpeRatio(equity: EquityPoint[]): number {
    if (equity.length < 2) {
      return 0;
    }

    // Calculate returns
    const returns: number[] = [];
    for (let i = 1; i < equity.length; i++) {
      const ret = (equity[i].equity - equity[i - 1].equity) / equity[i - 1].equity;
      returns.push(ret);
    }

    if (returns.length === 0) {
      return 0;
    }

    // Calculate average return
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

    // Calculate standard deviation
    const variance =
      returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      return 0;
    }

    // Annualized Sharpe Ratio (assuming daily returns)
    // Multiply by sqrt(365) to annualize
    const sharpeRatio = (avgReturn / stdDev) * Math.sqrt(365);

    return sharpeRatio;
  }

  /**
   * Calculate drawdown metrics
   */
  private calculateDrawdown(equity: EquityPoint[]): {
    maxDrawdown: number;
    maxDrawdownPercent: number;
    currentDrawdown: number;
    currentDrawdownPercent: number;
  } {
    if (equity.length === 0) {
      return {
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        currentDrawdown: 0,
        currentDrawdownPercent: 0,
      };
    }

    let maxEquity = equity[0].equity;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;

    for (const point of equity) {
      // Update peak
      if (point.equity > maxEquity) {
        maxEquity = point.equity;
      }

      // Calculate drawdown from peak
      const drawdown = maxEquity - point.equity;
      const drawdownPercent = maxEquity > 0 ? (drawdown / maxEquity) * 100 : 0;

      // Update max drawdown
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
      }
    }

    // Calculate current drawdown (from last equity point)
    const lastEquity = equity[equity.length - 1].equity;
    const currentDrawdown = maxEquity - lastEquity;
    const currentDrawdownPercent = maxEquity > 0 ? (currentDrawdown / maxEquity) * 100 : 0;

    return {
      maxDrawdown,
      maxDrawdownPercent,
      currentDrawdown,
      currentDrawdownPercent,
    };
  }

  /**
   * Calculate average trade duration
   */
  private calculateAverageTradeDuration(trades: Trade[]): number {
    if (trades.length === 0) {
      return 0;
    }

    // Group trades by position to calculate duration
    // For now, return 0 as we need position open/close times
    // This would be enhanced with actual position data
    return 0;
  }

  /**
   * Calculate additional metrics
   */
  calculateAdditionalMetrics(trades: Trade[]): {
    largestWin: number;
    largestLoss: number;
    averageTradeSize: number;
    totalFees: number;
    consecutiveWins: number;
    consecutiveLosses: number;
    expectancy: number;
  } {
    if (trades.length === 0) {
      return {
        largestWin: 0,
        largestLoss: 0,
        averageTradeSize: 0,
        totalFees: 0,
        consecutiveWins: 0,
        consecutiveLosses: 0,
        expectancy: 0,
      };
    }

    // Find largest win and loss
    let largestWin = 0;
    let largestLoss = 0;

    for (const trade of trades) {
      if (trade.pnl) {
        if (trade.pnl > largestWin) {
          largestWin = trade.pnl;
        }
        if (trade.pnl < largestLoss) {
          largestLoss = trade.pnl;
        }
      }
    }

    // Calculate average trade size
    const totalSize = trades.reduce((sum, t) => sum + t.quantity * t.price, 0);
    const averageTradeSize = totalSize / trades.length;

    // Calculate total fees
    const totalFees = trades.reduce((sum, t) => sum + t.fee, 0);

    // Calculate consecutive wins/losses
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let lastWasWin = false;

    for (const trade of trades) {
      if (trade.pnl) {
        const isWin = trade.pnl > 0;

        if (isWin === lastWasWin) {
          currentStreak++;
        } else {
          currentStreak = 1;
          lastWasWin = isWin;
        }

        if (isWin && currentStreak > maxWinStreak) {
          maxWinStreak = currentStreak;
        } else if (!isWin && currentStreak > maxLossStreak) {
          maxLossStreak = currentStreak;
        }
      }
    }

    // Calculate expectancy (average profit per trade)
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const expectancy = totalPnL / trades.length;

    return {
      largestWin,
      largestLoss,
      averageTradeSize,
      totalFees,
      consecutiveWins: maxWinStreak,
      consecutiveLosses: maxLossStreak,
      expectancy,
    };
  }

  /**
   * Calculate monthly returns
   */
  calculateMonthlyReturns(equity: EquityPoint[]): Map<string, number> {
    const monthlyReturns = new Map<string, number>();

    if (equity.length < 2) {
      return monthlyReturns;
    }

    let currentMonth = '';
    let monthStartEquity = equity[0].equity;

    for (let i = 1; i < equity.length; i++) {
      const date = new Date(equity[i].timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (monthKey !== currentMonth) {
        if (currentMonth !== '') {
          // Calculate return for previous month
          const monthReturn = ((equity[i - 1].equity - monthStartEquity) / monthStartEquity) * 100;
          monthlyReturns.set(currentMonth, monthReturn);
        }

        currentMonth = monthKey;
        monthStartEquity = equity[i].equity;
      }
    }

    // Add last month
    if (currentMonth !== '') {
      const lastEquity = equity[equity.length - 1].equity;
      const monthReturn = ((lastEquity - monthStartEquity) / monthStartEquity) * 100;
      monthlyReturns.set(currentMonth, monthReturn);
    }

    return monthlyReturns;
  }

  /**
   * Calculate risk metrics
   */
  calculateRiskMetrics(equity: EquityPoint[]): {
    volatility: number;
    sortinoRatio: number;
    calmarRatio: number;
    maxConsecutiveLossDays: number;
  } {
    if (equity.length < 2) {
      return {
        volatility: 0,
        sortinoRatio: 0,
        calmarRatio: 0,
        maxConsecutiveLossDays: 0,
      };
    }

    // Calculate returns
    const returns: number[] = [];
    for (let i = 1; i < equity.length; i++) {
      const ret = (equity[i].equity - equity[i - 1].equity) / equity[i - 1].equity;
      returns.push(ret);
    }

    // Calculate volatility (standard deviation of returns)
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(365); // Annualized

    // Calculate Sortino Ratio (only considers downside volatility)
    const downsideReturns = returns.filter((r) => r < 0);
    const downsideVariance =
      downsideReturns.length > 0
        ? downsideReturns.reduce((sum, ret) => sum + Math.pow(ret, 2), 0) / downsideReturns.length
        : 0;
    const downsideDeviation = Math.sqrt(downsideVariance);
    const sortinoRatio =
      downsideDeviation > 0 ? (avgReturn / downsideDeviation) * Math.sqrt(365) : 0;

    // Calculate Calmar Ratio (return / max drawdown)
    const { maxDrawdownPercent } = this.calculateDrawdown(equity);
    const totalReturn = ((equity[equity.length - 1].equity - equity[0].equity) / equity[0].equity) * 100;
    const calmarRatio = maxDrawdownPercent > 0 ? totalReturn / maxDrawdownPercent : 0;

    // Calculate max consecutive loss days
    let currentLossDays = 0;
    let maxLossDays = 0;

    for (const ret of returns) {
      if (ret < 0) {
        currentLossDays++;
        if (currentLossDays > maxLossDays) {
          maxLossDays = currentLossDays;
        }
      } else {
        currentLossDays = 0;
      }
    }

    return {
      volatility,
      sortinoRatio,
      calmarRatio,
      maxConsecutiveLossDays: maxLossDays,
    };
  }
}

// Export singleton instance
export const metricsCalculator = new MetricsCalculator();
