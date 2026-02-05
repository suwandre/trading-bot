/**
 * Backtest Report Generator
 * Generates comprehensive reports from backtest results
 */

import type { BacktestResult, Trade } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('ReportGenerator');

export class ReportGenerator {
  constructor() {
    logger.info('Report Generator initialized');
  }

  /**
   * Generate a comprehensive text report
   */
  generateTextReport(result: BacktestResult): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('BACKTEST REPORT');
    lines.push('='.repeat(80));
    lines.push('');

    // Strategy Information
    lines.push('STRATEGY INFORMATION');
    lines.push('-'.repeat(80));
    lines.push(`Strategy Name: ${result.config.strategy.name}`);
    lines.push(`Strategy Type: ${result.config.strategy.type.toUpperCase()}`);
    lines.push(`Symbol: ${result.config.symbol}`);
    lines.push(`Timeframe: ${result.config.timeframe}`);
    lines.push(`Period: ${new Date(result.config.startTime).toISOString()} to ${new Date(result.config.endTime).toISOString()}`);
    lines.push(`Initial Capital: $${result.config.initialCapital.toFixed(2)}`);
    lines.push(`Fee Rate: ${(result.config.feeRate * 100).toFixed(3)}%`);
    lines.push(`Slippage: ${result.config.slippagePercent.toFixed(3)}%`);
    lines.push('');

    // Performance Metrics
    lines.push('PERFORMANCE METRICS');
    lines.push('-'.repeat(80));
    lines.push(`Total P&L: $${result.metrics.totalPnL.toFixed(2)} (${result.metrics.totalPnLPercent.toFixed(2)}%)`);
    lines.push(`Total Trades: ${result.metrics.totalTrades}`);
    lines.push(`Winning Trades: ${result.metrics.winningTrades} (${(result.metrics.winRate * 100).toFixed(2)}%)`);
    lines.push(`Losing Trades: ${result.metrics.losingTrades}`);
    lines.push(`Average Win: $${result.metrics.averageWin.toFixed(2)}`);
    lines.push(`Average Loss: $${result.metrics.averageLoss.toFixed(2)}`);
    lines.push(`Profit Factor: ${result.metrics.profitFactor.toFixed(2)}`);
    lines.push('');

    // Risk Metrics
    lines.push('RISK METRICS');
    lines.push('-'.repeat(80));
    lines.push(`Sharpe Ratio: ${result.metrics.sharpeRatio.toFixed(2)}`);
    lines.push(`Max Drawdown: $${result.metrics.maxDrawdown.toFixed(2)} (${result.metrics.maxDrawdownPercent.toFixed(2)}%)`);
    lines.push('');

    // Trade Statistics
    lines.push('TRADE STATISTICS');
    lines.push('-'.repeat(80));

    const totalFees = result.trades.reduce((sum, t) => sum + t.fee, 0);
    const totalVolume = result.trades.reduce((sum, t) => sum + t.quantity * t.price, 0);

    lines.push(`Total Volume: $${totalVolume.toFixed(2)}`);
    lines.push(`Total Fees: $${totalFees.toFixed(2)}`);

    if (result.trades.length > 0) {
      const avgTradeSize = totalVolume / result.trades.length;
      lines.push(`Average Trade Size: $${avgTradeSize.toFixed(2)}`);
    }

    lines.push('');

    // Execution Statistics
    lines.push('EXECUTION STATISTICS');
    lines.push('-'.repeat(80));
    lines.push(`Candles Processed: ${result.candlesProcessed}`);
    lines.push(`Execution Time: ${(result.duration / 1000).toFixed(2)}s`);
    lines.push(`Processing Speed: ${(result.candlesProcessed / (result.duration / 1000)).toFixed(0)} candles/second`);
    lines.push('');

    // Top Trades
    if (result.trades.length > 0) {
      lines.push('TOP 5 WINNING TRADES');
      lines.push('-'.repeat(80));

      const winningTrades = result.trades
        .filter((t) => t.pnl && t.pnl > 0)
        .sort((a, b) => (b.pnl || 0) - (a.pnl || 0))
        .slice(0, 5);

      winningTrades.forEach((trade, index) => {
        lines.push(
          `${index + 1}. ${trade.side.toUpperCase()} ${trade.quantity.toFixed(6)} @ $${trade.price.toFixed(2)} - P&L: $${trade.pnl?.toFixed(2)}`
        );
      });

      lines.push('');

      lines.push('TOP 5 LOSING TRADES');
      lines.push('-'.repeat(80));

      const losingTrades = result.trades
        .filter((t) => t.pnl && t.pnl < 0)
        .sort((a, b) => (a.pnl || 0) - (b.pnl || 0))
        .slice(0, 5);

      losingTrades.forEach((trade, index) => {
        lines.push(
          `${index + 1}. ${trade.side.toUpperCase()} ${trade.quantity.toFixed(6)} @ $${trade.price.toFixed(2)} - P&L: $${trade.pnl?.toFixed(2)}`
        );
      });

      lines.push('');
    }

    lines.push('='.repeat(80));

    return lines.join('\n');
  }

  /**
   * Generate JSON report
   */
  generateJSONReport(result: BacktestResult): string {
    const report = {
      strategy: {
        name: result.config.strategy.name,
        type: result.config.strategy.type,
        symbol: result.config.symbol,
        timeframe: result.config.timeframe,
      },
      period: {
        start: new Date(result.config.startTime).toISOString(),
        end: new Date(result.config.endTime).toISOString(),
      },
      capital: {
        initial: result.config.initialCapital,
        final: result.equity[result.equity.length - 1]?.equity || 0,
      },
      metrics: result.metrics,
      execution: {
        duration: result.duration,
        candlesProcessed: result.candlesProcessed,
        processingSpeed: result.candlesProcessed / (result.duration / 1000),
      },
      trades: {
        total: result.trades.length,
        summary: this.generateTradeSummary(result.trades),
      },
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate CSV report of trades
   */
  generateTradesCSV(trades: Trade[]): string {
    const lines: string[] = [];

    // Header
    lines.push('Timestamp,Symbol,Side,Quantity,Price,Fee,P&L');

    // Trades
    for (const trade of trades) {
      lines.push(
        [
          trade.timestamp.toISOString(),
          trade.symbol,
          trade.side,
          trade.quantity.toFixed(8),
          trade.price.toFixed(2),
          trade.fee.toFixed(4),
          trade.pnl?.toFixed(2) || '',
        ].join(',')
      );
    }

    return lines.join('\n');
  }

  /**
   * Generate equity curve CSV
   */
  generateEquityCSV(result: BacktestResult): string {
    const lines: string[] = [];

    // Header
    lines.push('Timestamp,Equity,Drawdown,DrawdownPercent');

    // Data
    for (let i = 0; i < result.equity.length; i++) {
      const eq = result.equity[i];
      const dd = result.drawdown[i];

      lines.push(
        [
          new Date(eq.timestamp).toISOString(),
          eq.equity.toFixed(2),
          dd.drawdown.toFixed(2),
          dd.drawdownPercent.toFixed(2),
        ].join(',')
      );
    }

    return lines.join('\n');
  }

  /**
   * Generate trade summary
   */
  private generateTradeSummary(trades: Trade[]): any {
    const winningTrades = trades.filter((t) => t.pnl && t.pnl > 0);
    const losingTrades = trades.filter((t) => t.pnl && t.pnl < 0);

    const totalVolume = trades.reduce((sum, t) => sum + t.quantity * t.price, 0);
    const totalFees = trades.reduce((sum, t) => sum + t.fee, 0);

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      totalVolume: totalVolume.toFixed(2),
      totalFees: totalFees.toFixed(2),
      averageTradeSize: trades.length > 0 ? (totalVolume / trades.length).toFixed(2) : 0,
    };
  }

  /**
   * Save report to file
   */
  async saveReport(result: BacktestResult, format: 'text' | 'json' | 'csv' = 'text'): Promise<string> {
    const timestamp = Date.now();
    const strategyName = result.config.strategy.name.replace(/\s+/g, '-').toLowerCase();
    
    let content: string;
    let extension: string;

    switch (format) {
      case 'json':
        content = this.generateJSONReport(result);
        extension = 'json';
        break;

      case 'csv':
        content = this.generateTradesCSV(result.trades);
        extension = 'csv';
        break;

      default:
        content = this.generateTextReport(result);
        extension = 'txt';
    }

    const filename = `backtest-${strategyName}-${timestamp}.${extension}`;

    logger.info('Report generated', {
      filename,
      format,
      size: content.length,
    });

    return content;
  }
}

// Export singleton instance
export const reportGenerator = new ReportGenerator();
