CREATE TABLE trades (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID REFERENCES orders(id),
    symbol      TEXT NOT NULL,
    side        trade_side NOT NULL,
    price       NUMERIC(20, 8) NOT NULL,
    quantity    NUMERIC(20, 8) NOT NULL,
    fee         NUMERIC(20, 8) NOT NULL DEFAULT 0,
    realised_pnl NUMERIC(20, 8) NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
