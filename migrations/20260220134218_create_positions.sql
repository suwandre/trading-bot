CREATE TYPE position_status AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE trade_side AS ENUM ('BUY', 'SELL');

CREATE TABLE positions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol      TEXT NOT NULL,
    side        trade_side NOT NULL,
    entry_price NUMERIC(20, 8) NOT NULL,
    quantity    NUMERIC(20, 8) NOT NULL,
    status      position_status NOT NULL DEFAULT 'OPEN',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
