-- ==============================================================================
-- Migration: Macro Categories (קבוצות על) & Payment Method Aliases
-- Description: Adds macro_categories table for grouping expenses (Fixed, Variable,
--              Seasonal/Vacation) and incomes (Salaries, Benefits), links categories
--              with macro_category_id, and adds payment_method_mappings table.
-- Date: 2026-08-11
-- ==============================================================================

-- 1. Create Macro_Categories Table
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

-- 2. Indexes on Macro_Categories
CREATE INDEX IF NOT EXISTS idx_macro_categories_household ON public.macro_categories(household_id);
CREATE INDEX IF NOT EXISTS idx_macro_categories_type ON public.macro_categories(type);

-- 3. Enable RLS on Macro_Categories
ALTER TABLE public.macro_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view macro categories in their households"
    ON public.macro_categories FOR SELECT
    USING (public.is_household_member(household_id));

CREATE POLICY "Users can insert macro categories in their households"
    ON public.macro_categories FOR INSERT
    WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "Users can update macro categories in their households"
    ON public.macro_categories FOR UPDATE
    USING (public.is_household_member(household_id))
    WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "Users can delete macro categories in their households"
    ON public.macro_categories FOR DELETE
    USING (public.is_household_member(household_id));

-- 4. Add macro_category_id to categories table
ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS macro_category_id UUID REFERENCES public.macro_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categories_macro_cat ON public.categories(macro_category_id);

-- 5. Create Payment_Method_Mappings Table (טבלת המרת כרטיסי אשראי ומקורות הוצאה)
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

-- 6. Indexes & RLS for Payment_Method_Mappings
CREATE INDEX IF NOT EXISTS idx_payment_mappings_household ON public.payment_method_mappings(household_id);
CREATE INDEX IF NOT EXISTS idx_payment_mappings_pattern ON public.payment_method_mappings(raw_pattern);

ALTER TABLE public.payment_method_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment mappings in their households"
    ON public.payment_method_mappings FOR SELECT
    USING (public.is_household_member(household_id));

CREATE POLICY "Users can insert payment mappings in their households"
    ON public.payment_method_mappings FOR INSERT
    WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "Users can update payment mappings in their households"
    ON public.payment_method_mappings FOR UPDATE
    USING (public.is_household_member(household_id))
    WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "Users can delete payment mappings in their households"
    ON public.payment_method_mappings FOR DELETE
    USING (public.is_household_member(household_id));

-- 7. Updated_at Trigger
CREATE OR REPLACE TRIGGER set_macro_categories_timestamp
    BEFORE UPDATE ON public.macro_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE OR REPLACE TRIGGER set_payment_method_mappings_timestamp
    BEFORE UPDATE ON public.payment_method_mappings
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();
