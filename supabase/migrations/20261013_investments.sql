-- ==============================================================================
-- Migration: Investments & Portfolio Tracking (ניירות ערך, פעימות וסגירות תקופה)
-- Date: 2026-10-13
-- ==============================================================================

-- 1. Helper function for tenant membership (if not already created)
CREATE OR REPLACE FUNCTION public.get_user_households(user_uuid UUID)
RETURNS TABLE (household_id UUID)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT hm.household_id FROM public.household_members hm WHERE hm.user_id = user_uuid;
$$;

-- 2. INVESTMENTS TABLE (ניירות ערך עם פעימות רכישה)
CREATE TABLE IF NOT EXISTS public.investments (
    id TEXT PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    security_number TEXT,
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ILS',
    current_price NUMERIC(14, 4) NOT NULL DEFAULT 0.00,
    asset_type TEXT NOT NULL DEFAULT 'stock',
    tranches JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_investments_household ON public.investments(household_id);
CREATE INDEX IF NOT EXISTS idx_investments_ticker ON public.investments(ticker);

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.investments TO postgres, anon, authenticated, service_role;

DROP POLICY IF EXISTS "Tenant isolation for investments (SELECT)" ON public.investments;
CREATE POLICY "Tenant isolation for investments (SELECT)"
    ON public.investments FOR SELECT
    USING (household_id IN (SELECT hm.household_id FROM public.household_members hm WHERE hm.user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for investments (INSERT)" ON public.investments;
CREATE POLICY "Tenant isolation for investments (INSERT)"
    ON public.investments FOR INSERT
    WITH CHECK (household_id IN (SELECT hm.household_id FROM public.household_members hm WHERE hm.user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for investments (UPDATE)" ON public.investments;
CREATE POLICY "Tenant isolation for investments (UPDATE)"
    ON public.investments FOR UPDATE
    USING (household_id IN (SELECT hm.household_id FROM public.household_members hm WHERE hm.user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for investments (DELETE)" ON public.investments;
CREATE POLICY "Tenant isolation for investments (DELETE)"
    ON public.investments FOR DELETE
    USING (household_id IN (SELECT hm.household_id FROM public.household_members hm WHERE hm.user_id = auth.uid()));

DROP TRIGGER IF EXISTS update_investments_modtime ON public.investments;
CREATE TRIGGER update_investments_modtime BEFORE UPDATE ON public.investments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. PERIODIC SNAPSHOTS TABLE (סגירות תקופה היסטוריות של תיק ההשקעות)
CREATE TABLE IF NOT EXISTS public.investment_snapshots (
    id TEXT PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL,
    period_label TEXT NOT NULL,
    date DATE NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_invested NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_profit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_return_pct NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_investment_snapshots_household ON public.investment_snapshots(household_id);

ALTER TABLE public.investment_snapshots ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.investment_snapshots TO postgres, anon, authenticated, service_role;

DROP POLICY IF EXISTS "Tenant isolation for investment_snapshots (SELECT)" ON public.investment_snapshots;
CREATE POLICY "Tenant isolation for investment_snapshots (SELECT)"
    ON public.investment_snapshots FOR SELECT
    USING (household_id IN (SELECT hm.household_id FROM public.household_members hm WHERE hm.user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for investment_snapshots (INSERT)" ON public.investment_snapshots;
CREATE POLICY "Tenant isolation for investment_snapshots (INSERT)"
    ON public.investment_snapshots FOR INSERT
    WITH CHECK (household_id IN (SELECT hm.household_id FROM public.household_members hm WHERE hm.user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for investment_snapshots (UPDATE)" ON public.investment_snapshots;
CREATE POLICY "Tenant isolation for investment_snapshots (UPDATE)"
    ON public.investment_snapshots FOR UPDATE
    USING (household_id IN (SELECT hm.household_id FROM public.household_members hm WHERE hm.user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for investment_snapshots (DELETE)" ON public.investment_snapshots;
CREATE POLICY "Tenant isolation for investment_snapshots (DELETE)"
    ON public.investment_snapshots FOR DELETE
    USING (household_id IN (SELECT hm.household_id FROM public.household_members hm WHERE hm.user_id = auth.uid()));

DROP TRIGGER IF EXISTS update_investment_snapshots_modtime ON public.investment_snapshots;
CREATE TRIGGER update_investment_snapshots_modtime BEFORE UPDATE ON public.investment_snapshots FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
