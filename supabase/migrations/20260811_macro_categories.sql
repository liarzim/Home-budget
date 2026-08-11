-- ==============================================================================
-- Migration: Macro Categories (קבוצות על) & Payment Method Aliases
-- Description: Self-contained migration including helper functions and RLS policies.
-- Date: 2026-08-11
-- ==============================================================================

-- 1. Helper Functions (Prevent RLS function missing errors)
CREATE OR REPLACE FUNCTION public.get_user_households(user_uuid UUID)
RETURNS TABLE (household_id UUID)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT hm.household_id FROM public.household_members hm WHERE hm.user_id = user_uuid;
$$;

CREATE OR REPLACE FUNCTION public.is_household_member(h_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.household_members hm
        WHERE hm.household_id = h_id AND hm.user_id = auth.uid()
    );
$$;

-- 2. Create Macro_Categories Table (קבוצות על: הוצאות קבועות, משתנות, עונתיות)
CREATE TABLE IF NOT EXISTS public.macro_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
    color TEXT NOT NULL DEFAULT '#4F46E5',
    icon TEXT NOT NULL DEFAULT 'ShoppingBag',
    display_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_macro_categories_household ON public.macro_categories(household_id);
CREATE INDEX IF NOT EXISTS idx_macro_categories_type ON public.macro_categories(type);

ALTER TABLE public.macro_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view macro categories in their households" ON public.macro_categories;
CREATE POLICY "Users can view macro categories in their households"
    ON public.macro_categories FOR SELECT
    USING (household_id IN (SELECT public.get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Users can insert macro categories in their households" ON public.macro_categories;
CREATE POLICY "Users can insert macro categories in their households"
    ON public.macro_categories FOR INSERT
    WITH CHECK (household_id IN (SELECT public.get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Users can update macro categories in their households" ON public.macro_categories;
CREATE POLICY "Users can update macro categories in their households"
    ON public.macro_categories FOR UPDATE
    USING (household_id IN (SELECT public.get_user_households(auth.uid())))
    WITH CHECK (household_id IN (SELECT public.get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Users can delete macro categories in their households" ON public.macro_categories;
CREATE POLICY "Users can delete macro categories in their households"
    ON public.macro_categories FOR DELETE
    USING (household_id IN (SELECT public.get_user_households(auth.uid())));

-- 3. Link categories table with macro_category_id
ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS macro_category_id UUID REFERENCES public.macro_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categories_macro_cat ON public.categories(macro_category_id);

-- 4. Create Payment_Method_Mappings Table (המרת שמות כרטיסים ומקורות הוצאה)
CREATE TABLE IF NOT EXISTS public.payment_method_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    raw_pattern TEXT NOT NULL,
    display_name TEXT NOT NULL,
    card_last_digits TEXT,
    payment_type TEXT NOT NULL DEFAULT 'credit_card' CHECK (payment_type IN ('credit_card', 'bank_transfer', 'cash', 'standing_order', 'check', 'other')),
    color TEXT DEFAULT '#4F46E5',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_mappings_household ON public.payment_method_mappings(household_id);
CREATE INDEX IF NOT EXISTS idx_payment_mappings_pattern ON public.payment_method_mappings(raw_pattern);

ALTER TABLE public.payment_method_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view payment mappings in their households" ON public.payment_method_mappings;
CREATE POLICY "Users can view payment mappings in their households"
    ON public.payment_method_mappings FOR SELECT
    USING (household_id IN (SELECT public.get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Users can insert payment mappings in their households" ON public.payment_method_mappings;
CREATE POLICY "Users can insert payment mappings in their households"
    ON public.payment_method_mappings FOR INSERT
    WITH CHECK (household_id IN (SELECT public.get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Users can update payment mappings in their households" ON public.payment_method_mappings;
CREATE POLICY "Users can update payment mappings in their households"
    ON public.payment_method_mappings FOR UPDATE
    USING (household_id IN (SELECT public.get_user_households(auth.uid())))
    WITH CHECK (household_id IN (SELECT public.get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Users can delete payment mappings in their households" ON public.payment_method_mappings;
CREATE POLICY "Users can delete payment mappings in their households"
    ON public.payment_method_mappings FOR DELETE
    USING (household_id IN (SELECT public.get_user_households(auth.uid())));
