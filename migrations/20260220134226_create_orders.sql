CREATE TYPE order_status AS ENUM ('PENDING', 'FILLED', 'CANCELLED');
CREATE TYPE order_type   AS ENUM ('MARKET', 'LIMIT');

CREATE TABLE orders (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_order_id  TEXT UNIQUE,
    position_id        UUID REFERENCES positions(id),
    symbol             TEXT NOT NULL,
    side               trade_side NOT NULL,
    order_type         order_type NOT NULL,
    price              NUMERIC(20, 8),
    quantity           NUMERIC(20, 8) NOT NULL,
    status             order_status NOT NULL DEFAULT 'PENDING',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
