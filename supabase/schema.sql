-- ============================================================================
-- MULTI-TENANT HOUSEHOLD BUDGET MANAGEMENT SYSTEM - DATABASE SCHEMA & RLS
-- ============================================================================
-- Designed for Supabase (PostgreSQL 15+)
-- Features:
--  1. Strict Tenant Isolation using Row Level Security (RLS) on all tables.
--  2. Security Definer helper functions to avoid recursion.
--  3. Automated user onboarding trigger (Profile + Default Household + Seed Categories).
--  4. Fully Idempotent (safe to run multiple times without duplicate errors).
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES (Users linked to auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. HOUSEHOLDS (Tenants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ILS',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. HOUSEHOLD_MEMBERS (Tenant Membership & Role Management)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.household_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    is_default BOOLEAN NOT NULL DEFAULT false,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(household_id, user_id)
);

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_household_members_user ON public.household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household ON public.household_members(household_id);

-- ============================================================================
-- 4. CATEGORIES (Expense and Income Categories)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    color TEXT DEFAULT '#4F46E5',
    icon TEXT DEFAULT 'tag',
    parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(household_id, name, type)
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_categories_household ON public.categories(household_id);

-- ============================================================================
-- 5. BUSINESS_MAPPING (Auto-Categorization Rules for Merchant Names)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.business_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    pattern TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    priority INT NOT NULL DEFAULT 0,
    is_regex BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.business_mapping ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_business_mapping_household ON public.business_mapping(household_id);

-- ============================================================================
-- 6. TRANSACTIONS (Centralized Ledger with Soft-Delete is_hidden)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(12, 2) NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL DEFAULT 'expense' CHECK (transaction_type IN ('expense', 'income', 'transfer')),
    payee_name TEXT NOT NULL,
    original_description TEXT,
    payment_method TEXT DEFAULT 'credit_card',
    card_last_digits TEXT,
    is_hidden BOOLEAN NOT NULL DEFAULT false, -- Soft delete / hidden flag
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_transactions_household ON public.transactions(household_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_is_hidden ON public.transactions(is_hidden);

-- ============================================================================
-- 7. BUDGETS (Strict Monthly and Yearly Limits Per Category)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'yearly')),
    year INT NOT NULL,
    month INT CHECK (month BETWEEN 1 AND 12),
    limit_amount NUMERIC(12, 2) NOT NULL CHECK (limit_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT check_month_for_monthly CHECK (
        (period_type = 'monthly' AND month IS NOT NULL) OR
        (period_type = 'yearly' AND month IS NULL)
    ),
    UNIQUE(household_id, category_id, period_type, year, month)
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_budgets_household ON public.budgets(household_id);

-- ============================================================================
-- 8. SAVINGS (Opening and Closing Balances Per Calendar Year)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.savings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    account_name TEXT NOT NULL,
    institution TEXT,
    year INT NOT NULL,
    opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    closing_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    target_amount NUMERIC(14, 2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(household_id, account_name, year)
);

ALTER TABLE public.savings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_savings_household ON public.savings(household_id);

-- ============================================================================
-- SECURITY DEFINER HELPER FUNCTIONS (Prevent Infinite RLS Recursion)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_households(user_uuid UUID)
RETURNS TABLE (household_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT hm.household_id
    FROM public.household_members hm
    WHERE hm.user_id = user_uuid;
$$;

CREATE OR REPLACE FUNCTION public.is_household_member(h_id UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.household_members hm
        WHERE hm.household_id = h_id AND hm.user_id = user_uuid
    );
$$;

CREATE OR REPLACE FUNCTION public.is_household_admin(h_id UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.household_members hm
        WHERE hm.household_id = h_id 
          AND hm.user_id = user_uuid 
          AND hm.role IN ('owner', 'admin')
    );
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES (With Safe DROP IF EXISTS)
-- ============================================================================

-- --- PROFILES ---
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- --- HOUSEHOLDS ---
DROP POLICY IF EXISTS "Users can view households they belong to" ON public.households;
CREATE POLICY "Users can view households they belong to"
    ON public.households FOR SELECT
    USING (id IN (SELECT get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Authenticated users can create households" ON public.households;
CREATE POLICY "Authenticated users can create households"
    ON public.households FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins/Owners can update their households" ON public.households;
CREATE POLICY "Admins/Owners can update their households"
    ON public.households FOR UPDATE
    USING (is_household_admin(id, auth.uid()));

DROP POLICY IF EXISTS "Owners can delete their households" ON public.households;
CREATE POLICY "Owners can delete their households"
    ON public.households FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.household_members
        WHERE household_id = public.households.id
          AND user_id = auth.uid()
          AND role = 'owner'
    ));

-- --- HOUSEHOLD_MEMBERS ---
DROP POLICY IF EXISTS "Members can view other members in their households" ON public.household_members;
CREATE POLICY "Members can view other members in their households"
    ON public.household_members FOR SELECT
    USING (household_id IN (SELECT get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Admins/Owners can add members" ON public.household_members;
CREATE POLICY "Admins/Owners can add members"
    ON public.household_members FOR INSERT
    WITH CHECK (
        is_household_admin(household_id, auth.uid()) OR
        NOT EXISTS (SELECT 1 FROM public.household_members WHERE household_id = household_members.household_id)
    );

DROP POLICY IF EXISTS "Admins/Owners can update member roles" ON public.household_members;
CREATE POLICY "Admins/Owners can update member roles"
    ON public.household_members FOR UPDATE
    USING (is_household_admin(household_id, auth.uid()));

DROP POLICY IF EXISTS "Admins/Owners can remove members or users can leave" ON public.household_members;
CREATE POLICY "Admins/Owners can remove members or users can leave"
    ON public.household_members FOR DELETE
    USING (
        is_household_admin(household_id, auth.uid()) OR
        user_id = auth.uid()
    );

-- --- CATEGORIES ---
DROP POLICY IF EXISTS "Tenant isolation for categories (SELECT)" ON public.categories;
CREATE POLICY "Tenant isolation for categories (SELECT)"
    ON public.categories FOR SELECT
    USING (household_id IN (SELECT get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Tenant isolation for categories (INSERT)" ON public.categories;
CREATE POLICY "Tenant isolation for categories (INSERT)"
    ON public.categories FOR INSERT
    WITH CHECK (household_id IN (SELECT get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Tenant isolation for categories (UPDATE)" ON public.categories;
CREATE POLICY "Tenant isolation for categories (UPDATE)"
    ON public.categories FOR UPDATE
    USING (household_id IN (SELECT get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Tenant isolation for categories (DELETE)" ON public.categories;
CREATE POLICY "Tenant isolation for categories (DELETE)"
    ON public.categories FOR DELETE
    USING (household_id IN (SELECT get_user_households(auth.uid())));

-- --- BUSINESS_MAPPING ---
DROP POLICY IF EXISTS "Tenant isolation for business_mapping (SELECT)" ON public.business_mapping;
CREATE POLICY "Tenant isolation for business_mapping (SELECT)"
    ON public.business_mapping FOR SELECT
    USING (household_id IN (SELECT get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Tenant isolation for business_mapping (INSERT)" ON public.business_mapping;
CREATE POLICY "Tenant isolation for business_mapping (INSERT)"
    ON public.business_mapping FOR INSERT
    WITH CHECK (household_id IN (SELECT get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Tenant isolation for business_mapping (UPDATE)" ON public.business_mapping;
CREATE POLICY "Tenant isolation for business_mapping (UPDATE)"
    ON public.business_mapping FOR UPDATE
    USING (household_id IN (SELECT get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Tenant isolation for business_mapping (DELETE)" ON public.business_mapping;
CREATE POLICY "Tenant isolation for business_mapping (DELETE)"
    ON public.business_mapping FOR DELETE
    USING (household_id IN (SELECT get_user_households(auth.uid())));

-- --- TRANSACTIONS ---
DROP POLICY IF EXISTS "Tenant isolation for transactions (SELECT)" ON public.transactions;
CREATE POLICY "Tenant isolation for transactions (SELECT)"
    ON public.transactions FOR SELECT
    USING (household_id IN (SELECT get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Tenant isolation for transactions (INSERT)" ON public.transactions;
CREATE POLICY "Tenant isolation for transactions (INSERT)"
    ON public.transactions FOR INSERT
    WITH CHECK (household_id IN (SELECT get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Tenant isolation for transactions (UPDATE)" ON public.transactions;
CREATE POLICY "Tenant isolation for transactions (UPDATE)"
    ON public.transactions FOR UPDATE
    USING (household_id IN (SELECT get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Tenant isolation for transactions (DELETE)" ON public.transactions;
CREATE POLICY "Tenant isolation for transactions (DELETE)"
    ON public.transactions FOR DELETE
    USING (household_id IN (SELECT get_user_households(auth.uid())));

-- --- BUDGETS ---
DROP POLICY IF EXISTS "Tenant isolation for budgets (SELECT)" ON public.budgets;
CREATE POLICY "Tenant isolation for budgets (SELECT)"
    ON public.budgets FOR SELECT
    USING (household_id IN (SELECT get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Tenant isolation for budgets (INSERT)" ON public.budgets;
CREATE POLICY "Tenant isolation for budgets (INSERT)"
    ON public.budgets FOR INSERT
    WITH CHECK (household_id IN (SELECT get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Tenant isolation for budgets (UPDATE)" ON public.budgets;
CREATE POLICY "Tenant isolation for budgets (UPDATE)"
    ON public.budgets FOR UPDATE
    USING (household_id IN (SELECT get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Tenant isolation for budgets (DELETE)" ON public.budgets;
CREATE POLICY "Tenant isolation for budgets (DELETE)"
    ON public.budgets FOR DELETE
    USING (household_id IN (SELECT get_user_households(auth.uid())));

-- --- SAVINGS ---
DROP POLICY IF EXISTS "Tenant isolation for savings (SELECT)" ON public.savings;
CREATE POLICY "Tenant isolation for savings (SELECT)"
    ON public.savings FOR SELECT
    USING (household_id IN (SELECT get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Tenant isolation for savings (INSERT)" ON public.savings;
CREATE POLICY "Tenant isolation for savings (INSERT)"
    ON public.savings FOR INSERT
    WITH CHECK (household_id IN (SELECT get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Tenant isolation for savings (UPDATE)" ON public.savings;
CREATE POLICY "Tenant isolation for savings (UPDATE)"
    ON public.savings FOR UPDATE
    USING (household_id IN (SELECT get_user_households(auth.uid())));

DROP POLICY IF EXISTS "Tenant isolation for savings (DELETE)" ON public.savings;
CREATE POLICY "Tenant isolation for savings (DELETE)"
    ON public.savings FOR DELETE
    USING (household_id IN (SELECT get_user_households(auth.uid())));

-- ============================================================================
-- AUTOMATED USER ONBOARDING TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_household_id UUID;
    user_name TEXT;
BEGIN
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

    -- 1. Create Profile
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        user_name,
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = timezone('utc'::text, now());

    -- 2. Create Default Household if user doesn't already have one
    IF NOT EXISTS (SELECT 1 FROM public.household_members WHERE user_id = NEW.id) THEN
        INSERT INTO public.households (name, currency, created_by)
        VALUES (user_name || '''s Household', 'ILS', NEW.id)
        RETURNING id INTO new_household_id;

        -- 3. Add as Owner
        INSERT INTO public.household_members (household_id, user_id, role, is_default)
        VALUES (new_household_id, NEW.id, 'owner', true);

        -- 4. Seed Essential Categories
        INSERT INTO public.categories (household_id, name, type, color, icon, is_system) VALUES
            (new_household_id, 'Salary & Income', 'income', '#10B981', 'briefcase', true),
            (new_household_id, 'Investments & Returns', 'income', '#059669', 'trending-up', true),
            (new_household_id, 'Other Income', 'income', '#34D399', 'plus-circle', true),
            (new_household_id, 'Housing & Rent', 'expense', '#4F46E5', 'home', true),
            (new_household_id, 'Groceries & Supermarket', 'expense', '#F59E0B', 'shopping-cart', true),
            (new_household_id, 'Utilities & Bills', 'expense', '#6366F1', 'zap', true),
            (new_household_id, 'Transportation & Fuel', 'expense', '#EC4899', 'car', true),
            (new_household_id, 'Healthcare & Pharmacy', 'expense', '#EF4444', 'heart-pulse', true),
            (new_household_id, 'Dining & Restaurants', 'expense', '#F97316', 'utensils', true),
            (new_household_id, 'Leisure & Entertainment', 'expense', '#8B5CF6', 'film', true),
            (new_household_id, 'Education & Kids', 'expense', '#06B6D4', 'book-open', true),
            (new_household_id, 'Insurance & Financials', 'expense', '#64748B', 'shield-check', true);

        -- 5. Seed Common Israeli / International Merchant Mappings
        INSERT INTO public.business_mapping (household_id, pattern, category_id, priority)
        SELECT new_household_id, 'SHUFERSAL', id, 10 FROM public.categories WHERE household_id = new_household_id AND name = 'Groceries & Supermarket'
        UNION ALL
        SELECT new_household_id, 'SUPER-SAL', id, 10 FROM public.categories WHERE household_id = new_household_id AND name = 'Groceries & Supermarket'
        UNION ALL
        SELECT new_household_id, 'RAMI LEVI', id, 10 FROM public.categories WHERE household_id = new_household_id AND name = 'Groceries & Supermarket'
        UNION ALL
        SELECT new_household_id, 'YOHANANOF', id, 10 FROM public.categories WHERE household_id = new_household_id AND name = 'Groceries & Supermarket'
        UNION ALL
        SELECT new_household_id, 'PAZ', id, 10 FROM public.categories WHERE household_id = new_household_id AND name = 'Transportation & Fuel'
        UNION ALL
        SELECT new_household_id, 'SONOL', id, 10 FROM public.categories WHERE household_id = new_household_id AND name = 'Transportation & Fuel'
        UNION ALL
        SELECT new_household_id, 'SUPER-PHARM', id, 10 FROM public.categories WHERE household_id = new_household_id AND name = 'Healthcare & Pharmacy'
        UNION ALL
        SELECT new_household_id, 'BE PHARM', id, 10 FROM public.categories WHERE household_id = new_household_id AND name = 'Healthcare & Pharmacy'
        UNION ALL
        SELECT new_household_id, 'NETFLIX', id, 10 FROM public.categories WHERE household_id = new_household_id AND name = 'Leisure & Entertainment'
        UNION ALL
        SELECT new_household_id, 'SPOTIFY', id, 10 FROM public.categories WHERE household_id = new_household_id AND name = 'Leisure & Entertainment'
        UNION ALL
        SELECT new_household_id, 'IEC', id, 10 FROM public.categories WHERE household_id = new_household_id AND name = 'Utilities & Bills';
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger to execute upon new user signup in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- AUTO-UPDATE UPDATED_AT TIMESTAMP TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_modtime ON public.profiles;
CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_households_modtime ON public.households;
CREATE TRIGGER update_households_modtime BEFORE UPDATE ON public.households FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_categories_modtime ON public.categories;
CREATE TRIGGER update_categories_modtime BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_business_mapping_modtime ON public.business_mapping;
CREATE TRIGGER update_business_mapping_modtime BEFORE UPDATE ON public.business_mapping FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_transactions_modtime ON public.transactions;
CREATE TRIGGER update_transactions_modtime BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_budgets_modtime ON public.budgets;
CREATE TRIGGER update_budgets_modtime BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_savings_modtime ON public.savings;
CREATE TRIGGER update_savings_modtime BEFORE UPDATE ON public.savings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
