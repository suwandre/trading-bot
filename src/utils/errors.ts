/**
 * Custom error classes for the trading bot
 */

export class TradingBotError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'TradingBotError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends TradingBotError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class RiskLimitError extends TradingBotError {
  constructor(message: string) {
    super(message, 'RISK_LIMIT_ERROR', 403);
    this.name = 'RiskLimitError';
  }
}

export class ExchangeError extends TradingBotError {
  constructor(message: string, public exchangeName?: string) {
    super(message, 'EXCHANGE_ERROR', 502);
    this.name = 'ExchangeError';
  }
}

export class StrategyError extends TradingBotError {
  constructor(message: string, public strategyId?: string) {
    super(message, 'STRATEGY_ERROR', 500);
    this.name = 'StrategyError';
  }
}

export class InsufficientBalanceError extends TradingBotError {
  constructor(required: number, available: number) {
    super(
      `Insufficient balance: required ${required}, available ${available}`,
      'INSUFFICIENT_BALANCE',
      400
    );
    this.name = 'InsufficientBalanceError';
  }
}

export class OrderExecutionError extends TradingBotError {
  constructor(message: string, public orderId?: string) {
    super(message, 'ORDER_EXECUTION_ERROR', 500);
    this.name = 'OrderExecutionError';
  }
}

export class BacktestError extends TradingBotError {
  constructor(message: string) {
    super(message, 'BACKTEST_ERROR', 500);
    this.name = 'BacktestError';
  }
}
