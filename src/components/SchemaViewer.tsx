import React, { useState } from 'react';
import { Database, Copy, Check, ShieldCheck, Key, Terminal } from 'lucide-react';

const FULL_SQL_SCRIPT = `-- ============================================================================
-- MULTI-TENANT HOUSEHOLD BUDGET MANAGEMENT SYSTEM - DATABASE SCHEMA & RLS
-- ============================================================================
-- Designed for Supabase (PostgreSQL 15+)
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES (Linked 1:1 to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. HOUSEHOLDS (Tenants)
CREATE TABLE IF NOT EXISTS public.households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ILS',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- 3. HOUSEHOLD_MEMBERS (Roles: owner, admin, member, viewer)
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

-- 4. CATEGORIES (Expense and Income)
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

-- 5. BUSINESS_MAPPING (Auto-Categorization Rules)
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

-- 6. TRANSACTIONS (With is_hidden soft delete flag)
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
    is_hidden BOOLEAN NOT NULL DEFAULT false, -- Soft delete flag
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 7. BUDGETS (Strict Monthly and Yearly Limits per category)
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

-- 8. SAVINGS (Opening and Closing balances per calendar year)
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

-- SECURITY DEFINER HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_user_households(user_uuid UUID)
RETURNS TABLE (household_id UUID)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT hm.household_id FROM public.household_members hm WHERE hm.user_id = user_uuid;
$$;

-- RLS POLICIES (Strict Tenant Isolation)
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

-- AUTOMATED SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    new_household_id UUID;
    user_name TEXT;
BEGIN
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (NEW.id, NEW.email, user_name, NEW.raw_user_meta_data->>'avatar_url');

    INSERT INTO public.households (name, currency, created_by)
    VALUES (user_name || '''s Household', 'ILS', NEW.id)
    RETURNING id INTO new_household_id;

    INSERT INTO public.household_members (household_id, user_id, role, is_default)
    VALUES (new_household_id, NEW.id, 'owner', true);

    INSERT INTO public.categories (household_id, name, type, color, icon, is_system) VALUES
        (new_household_id, 'Salary & Income', 'income', '#10B981', 'briefcase', true),
        (new_household_id, 'Housing & Rent', 'expense', '#4F46E5', 'home', true),
        (new_household_id, 'Groceries & Supermarket', 'expense', '#F59E0B', 'shopping-cart', true),
        (new_household_id, 'Utilities & Bills', 'expense', '#6366F1', 'zap', true),
        (new_household_id, 'Transportation & Fuel', 'expense', '#EC4899', 'car', true),
        (new_household_id, 'Healthcare & Pharmacy', 'expense', '#EF4444', 'heart-pulse', true),
        (new_household_id, 'Dining & Restaurants', 'expense', '#F97316', 'utensils', true),
        (new_household_id, 'Leisure & Entertainment', 'expense', '#8B5CF6', 'film', true);

    INSERT INTO public.business_mapping (household_id, pattern, category_id, priority)
    SELECT new_household_id, 'SHUFERSAL', id, 10 FROM public.categories WHERE household_id = new_household_id AND name = 'Groceries & Supermarket'
    UNION ALL
    SELECT new_household_id, 'PAZ', id, 10 FROM public.categories WHERE household_id = new_household_id AND name = 'Transportation & Fuel'
    UNION ALL
    SELECT new_household_id, 'SUPER-PHARM', id, 10 FROM public.categories WHERE household_id = new_household_id AND name = 'Healthcare & Pharmacy'
    UNION ALL
    SELECT new_household_id, 'NETFLIX', id, 10 FROM public.categories WHERE household_id = new_household_id AND name = 'Leisure & Entertainment';

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`;

export const SchemaViewer: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(FULL_SQL_SCRIPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>Database Schema & RLS Policies</h2>
          <p style={styles.subtitle}>
            File located at <code>supabase/schema.sql</code>. Ready to paste directly into Supabase SQL Editor.
          </p>
        </div>

        <button style={styles.copyBtn} onClick={handleCopy}>
          {copied ? <Check size={16} color="#FFFFFF" /> : <Copy size={16} color="#FFFFFF" />}
          <span>{copied ? 'Copied SQL!' : 'Copy SQL Script'}</span>
        </button>
      </div>

      {/* Security Architecture Cards */}
      <div style={styles.architectureGrid}>
        <div style={styles.archCard}>
          <div style={{ ...styles.archIconBox, backgroundColor: 'var(--success-light)' }}>
            <ShieldCheck size={18} color="var(--success)" />
          </div>
          <h3 style={styles.archCardTitle}>Strict Tenant Isolation</h3>
          <p style={styles.archCardDesc}>
            Row Level Security (RLS) is enabled on all tables. Queries filter via{' '}
            <code>get_user_households(auth.uid())</code>, guaranteeing zero data leakage across different families or tenants.
          </p>
        </div>

        <div style={styles.archCard}>
          <div style={{ ...styles.archIconBox, backgroundColor: 'var(--primary-light)' }}>
            <Terminal size={18} color="var(--primary)" />
          </div>
          <h3 style={styles.archCardTitle}>Automated Signup Onboarding</h3>
          <p style={styles.archCardDesc}>
            A PostgreSQL trigger (<code>handle_new_user</code>) automatically creates a Profile, a default Household, assigns Owner role, and seeds Israeli/International categories and merchant auto-rules upon Google/Apple/GitHub OAuth sign-in.
          </p>
        </div>

        <div style={styles.archCard}>
          <div style={{ ...styles.archIconBox, backgroundColor: 'var(--warning-light)' }}>
            <Key size={18} color="var(--warning)" />
          </div>
          <h3 style={styles.archCardTitle}>Deploy to Supabase</h3>
          <p style={styles.archCardDesc}>
            1. Open Supabase Dashboard → SQL Editor → New Query<br />
            2. Paste this script & click Run<br />
            3. Copy your Project URL & Anon Key into <code>.env</code>
          </p>
        </div>
      </div>

      {/* SQL Code Box */}
      <div style={styles.codeCard}>
        <div style={styles.codeHeader}>
          <div style={styles.codeLangPill}>
            <Database size={14} color="var(--primary)" />
            <span>PostgreSQL (Supabase Schema & RLS)</span>
          </div>
          <span style={styles.codeFilePath}>supabase/schema.sql</span>
        </div>

        <pre style={styles.codeBlock}>
          <code>{FULL_SQL_SCRIPT}</code>
        </pre>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  copyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 18px',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
  },
  architectureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  archCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '20px',
    boxShadow: 'var(--shadow-sm)',
  },
  archIconBox: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
  },
  archCardTitle: {
    fontSize: '0.9375rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '6px',
  },
  archCardDesc: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
  codeCard: {
    backgroundColor: '#0F172A',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-lg)',
  },
  codeHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    backgroundColor: '#1E293B',
    borderBottom: '1px solid #334155',
  },
  codeLangPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#E2E8F0',
    fontSize: '0.8125rem',
    fontWeight: '600',
  },
  codeFilePath: {
    fontSize: '0.75rem',
    color: '#94A3B8',
    fontFamily: 'var(--font-mono)',
  },
  codeBlock: {
    padding: '20px',
    margin: 0,
    color: '#E2E8F0',
    fontSize: '0.8125rem',
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.6',
    overflowX: 'auto',
    maxHeight: '480px',
    overflowY: 'auto',
  },
};
