-- ==============================================================================
-- Migration: Security Daily Closing Prices (שערי נעילה יומיים לניירות ערך)
-- Date: 2026-10-13
-- Description: Records daily closing prices for securities held in portfolios
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.security_daily_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT NOT NULL,
    security_number TEXT,
    price_date DATE NOT NULL,
    closing_price NUMERIC(14, 4) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ILS',
    source TEXT DEFAULT 'Automated End-Of-Day Cron',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(ticker, price_date)
);

CREATE INDEX IF NOT EXISTS idx_security_daily_prices_ticker_date 
    ON public.security_daily_prices(ticker, price_date DESC);

CREATE INDEX IF NOT EXISTS idx_security_daily_prices_secnum_date 
    ON public.security_daily_prices(security_number, price_date DESC);

ALTER TABLE public.security_daily_prices ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.security_daily_prices TO postgres, anon, authenticated, service_role;

DROP POLICY IF EXISTS "Allow select daily prices for all" ON public.security_daily_prices;
CREATE POLICY "Allow select daily prices for all"
    ON public.security_daily_prices FOR SELECT
    TO authenticated, anon, service_role
    USING (true);

DROP POLICY IF EXISTS "Allow insert daily prices for authenticated and service_role" ON public.security_daily_prices;
CREATE POLICY "Allow insert daily prices for authenticated and service_role"
    ON public.security_daily_prices FOR INSERT
    TO authenticated, service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update daily prices for authenticated and service_role" ON public.security_daily_prices;
CREATE POLICY "Allow update daily prices for authenticated and service_role"
    ON public.security_daily_prices FOR UPDATE
    TO authenticated, service_role
    USING (true)
    WITH CHECK (true);
