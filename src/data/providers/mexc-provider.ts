/**
 * MEXC Exchange Provider
 * Used for live trading on MEXC exchange
 * TODO: Implement full MEXC integration for live trading
 */

import ccxt from 'ccxt';
import type {
  Timeframe,
  Candle,
  Ticker,
  TradingPair,
  Order,
  CreateOrderRequest,
  OrderSide,
  OrderType,
} from '../../types';
import { BaseExchangeProvider } from './base-provider';
import { ExchangeError } from '../../utils/errors';
import { appConfig } from '../../config/app.config';

export class MEXCProvider extends BaseExchangeProvider {
  private exchange: ccxt.mexc;

  constructor() {
    super('mexc');

    this.exchange = new ccxt.mexc({
      apiKey: appConfig.mexcApiKey,
      secret: appConfig.mexcApiSecret,
      enableRateLimit: true,
      options: {
        defaultType: 'spot',
      },
    });

    if (appConfig.mexcTestnet) {
      this.exchange.setSandboxMode(true);
    }
  }

  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to MEXC...');
      await this.exchange.loadMarkets();
      this.connected = true;
      this.logger.info('Connected to MEXC successfully');
    } catch (error) {
      this.logger.error('Failed to connect to MEXC', { error });
      throw new ExchangeError(
        `Failed to connect to MEXC: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'mexc'
      );
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.logger.info('Disconnected from MEXC');
  }

  async getCandles(
    symbol: string,
    timeframe: Timeframe,
    limit: number = 500,
    since?: number
  ): Promise<Candle[]> {
    this.ensureConnected();

    try {
      const ccxtTimeframe = this.convertTimeframe(timeframe);
      const ohlcv = await this.exchange.fetchOHLCV(symbol, ccxtTimeframe, since, limit);

      return ohlcv.map((data) => ({
        timestamp: data[0],
        open: data[1],
        high: data[2],
        low: data[3],
        close: data[4],
        volume: data[5],
      }));
    } catch (error) {
      this.logger.error('Failed to fetch candles', { symbol, timeframe, error });
      throw new ExchangeError(
        `Failed to fetch candles from MEXC: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'mexc'
      );
    }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    this.ensureConnected();

    try {
      const ticker = await this.exchange.fetchTicker(symbol);

      return {
        symbol,
        bid: ticker.bid || 0,
        ask: ticker.ask || 0,
        last: ticker.last || 0,
        volume: ticker.baseVolume || 0,
        timestamp: ticker.timestamp || Date.now(),
      };
    } catch (error) {
      this.logger.error('Failed to fetch ticker', { symbol, error });
      throw new ExchangeError(
        `Failed to fetch ticker from MEXC: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'mexc'
      );
    }
  }

  async getTradingPair(symbol: string): Promise<TradingPair> {
    this.ensureConnected();

    try {
      const market = this.exchange.market(symbol);

      return {
        symbol,
        base: market.base,
        quote: market.quote,
        minOrderSize: market.limits.amount?.min || 0,
        maxOrderSize: market.limits.amount?.max || Number.MAX_SAFE_INTEGER,
        pricePrecision: market.precision.price || 8,
        quantityPrecision: market.precision.amount || 8,
      };
    } catch (error) {
      this.logger.error('Failed to fetch trading pair', { symbol, error });
      throw new ExchangeError(
        `Failed to fetch trading pair from MEXC: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'mexc'
      );
    }
  }

  async createOrder(request: CreateOrderRequest): Promise<Order> {
    this.ensureConnected();

    try {
      const ccxtOrder = await this.exchange.createOrder(
        request.symbol,
        request.type,
        request.side,
        request.quantity,
        request.price
      );

      return this.convertCCXTOrder(ccxtOrder, request.strategyId);
    } catch (error) {
      this.logger.error('Failed to create order', { request, error });
      throw new ExchangeError(
        `Failed to create order on MEXC: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'mexc'
      );
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    this.ensureConnected();

    try {
      await this.exchange.cancelOrder(orderId);
      this.logger.info('Order cancelled', { orderId });
    } catch (error) {
      this.logger.error('Failed to cancel order', { orderId, error });
      throw new ExchangeError(
        `Failed to cancel order on MEXC: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'mexc'
      );
    }
  }

  async getOrder(orderId: string): Promise<Order> {
    this.ensureConnected();

    try {
      const ccxtOrder = await this.exchange.fetchOrder(orderId);
      return this.convertCCXTOrder(ccxtOrder, '');
    } catch (error) {
      this.logger.error('Failed to fetch order', { orderId, error });
      throw new ExchangeError(
        `Failed to fetch order from MEXC: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'mexc'
      );
    }
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    this.ensureConnected();

    try {
      const ccxtOrders = await this.exchange.fetchOpenOrders(symbol);
      return ccxtOrders.map((order) => this.convertCCXTOrder(order, ''));
    } catch (error) {
      this.logger.error('Failed to fetch open orders', { symbol, error });
      throw new ExchangeError(
        `Failed to fetch open orders from MEXC: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'mexc'
      );
    }
  }

  async getBalance(asset: string): Promise<number> {
    this.ensureConnected();

    try {
      const balance = await this.exchange.fetchBalance();
      return balance[asset]?.free || 0;
    } catch (error) {
      this.logger.error('Failed to fetch balance', { asset, error });
      throw new ExchangeError(
        `Failed to fetch balance from MEXC: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'mexc'
      );
    }
  }

  async getBalances(): Promise<Record<string, number>> {
    this.ensureConnected();

    try {
      const balance = await this.exchange.fetchBalance();
      const balances: Record<string, number> = {};

      for (const [asset, data] of Object.entries(balance)) {
        if (typeof data === 'object' && data !== null && 'free' in data) {
          balances[asset] = (data as any).free || 0;
        }
      }

      return balances;
    } catch (error) {
      this.logger.error('Failed to fetch balances', { error });
      throw new ExchangeError(
        `Failed to fetch balances from MEXC: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'mexc'
      );
    }
  }

  protected convertTimeframe(timeframe: Timeframe): string {
    const timeframeMap: Record<Timeframe, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
      '1w': '1w',
    };

    return timeframeMap[timeframe];
  }

  private convertCCXTOrder(ccxtOrder: any, strategyId: string): Order {
    return {
      id: ccxtOrder.id,
      strategyId,
      symbol: ccxtOrder.symbol,
      side: ccxtOrder.side as OrderSide,
      type: ccxtOrder.type as OrderType,
      quantity: ccxtOrder.amount,
      price: ccxtOrder.price,
      status: this.convertOrderStatus(ccxtOrder.status),
      filledQuantity: ccxtOrder.filled || 0,
      averageFillPrice: ccxtOrder.average || 0,
      fee: ccxtOrder.fee?.cost || 0,
      feeAsset: ccxtOrder.fee?.currency || 'USDT',
      createdAt: new Date(ccxtOrder.timestamp),
      updatedAt: new Date(ccxtOrder.timestamp),
      exchangeOrderId: ccxtOrder.id,
    };
  }

  private convertOrderStatus(ccxtStatus: string): Order['status'] {
    const statusMap: Record<string, Order['status']> = {
      open: 'open',
      closed: 'filled',
      canceled: 'cancelled',
      cancelled: 'cancelled',
      expired: 'expired',
      rejected: 'rejected',
    };

    return statusMap[ccxtStatus] || 'pending';
  }
}
