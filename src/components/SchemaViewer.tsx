import React, { useState } from 'react';
import { Database, Copy, Check, ShieldCheck, Key, Terminal, ExternalLink, Sparkles } from 'lucide-react';

const MIGRATION_SQL = `-- ==============================================================================
-- Migration: Macro Categories (קבוצות על) & Payment Method Aliases
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

CREATE INDEX IF NOT EXISTS idx_macro_categories_household ON public.macro_categories(household_id);
CREATE INDEX IF NOT EXISTS idx_macro_categories_type ON public.macro_categories(type);

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

-- 2. Link categories table with macro_category_id
ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS macro_category_id UUID REFERENCES public.macro_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categories_macro_cat ON public.categories(macro_category_id);

-- 3. Create Payment_Method_Mappings Table (שמות כרטיסים ומקורות הוצאה להצגה)
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
    USING (public.is_household_member(household_id));`;

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

-- 4. MACRO_CATEGORIES (Top-Level Budget Groups)
CREATE TABLE IF NOT EXISTS public.macro_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
    color TEXT NOT NULL DEFAULT '#4F46E5',
    icon TEXT NOT NULL DEFAULT 'ShoppingBag',
    display_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.macro_categories ENABLE ROW LEVEL SECURITY;

-- 5. CATEGORIES (Expense and Income Categories)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    color TEXT DEFAULT '#4F46E5',
    icon TEXT DEFAULT 'tag',
    macro_category_id UUID REFERENCES public.macro_categories(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(household_id, name, type)
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 6. PAYMENT_METHOD_MAPPINGS (Credit Cards & Aliases)
CREATE TABLE IF NOT EXISTS public.payment_method_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    raw_pattern TEXT NOT NULL,
    display_name TEXT NOT NULL,
    card_last_digits TEXT,
    payment_type TEXT NOT NULL DEFAULT 'credit_card' CHECK (payment_type IN ('credit_card', 'bank_transfer', 'cash', 'standing_order', 'check', 'other')),
    color TEXT DEFAULT '#4F46E5',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.payment_method_mappings ENABLE ROW LEVEL SECURITY;

-- 7. BUSINESS_MAPPING (Auto-Categorization Rules)
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

-- 8. TRANSACTIONS (With is_hidden soft delete flag)
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
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    source_reference_id TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 9. BUDGETS
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

-- 10. SAVINGS
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

-- Helper RLS function
CREATE OR REPLACE FUNCTION public.is_household_member(hh_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.household_members
        WHERE household_id = hh_id AND user_id = auth.uid()
    );
$$;`;

export const SchemaViewer: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'migration' | 'full'>('migration');

  const activeScript = viewMode === 'migration' ? MIGRATION_SQL : FULL_SQL_SCRIPT;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(activeScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>Database Schema & Supabase Migrations</h2>
          <p style={styles.subtitle}>
            Ready to paste directly into Supabase SQL Editor.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <a
            href="https://supabase.com/dashboard/project/hhrpcjkdkghnnqtqqqlo/sql/new"
            target="_blank"
            rel="noreferrer"
            style={styles.openDashboardBtn}
          >
            <ExternalLink size={15} />
            <span>Open Supabase SQL Editor</span>
          </a>

          <button style={styles.copyBtn} onClick={handleCopy}>
            {copied ? <Check size={16} color="#FFFFFF" /> : <Copy size={16} color="#FFFFFF" />}
            <span>{copied ? 'Copied SQL!' : 'Copy Active SQL Script'}</span>
          </button>
        </div>
      </div>

      {/* SQL Tab Selector */}
      <div style={styles.tabNav}>
        <button
          style={{
            ...styles.tabBtn,
            ...(viewMode === 'migration' ? styles.tabBtnActive : {}),
          }}
          onClick={() => setViewMode('migration')}
        >
          <Sparkles size={15} />
          <span>Latest Migration (2026-08-11 Macro Categories & Mappings)</span>
        </button>

        <button
          style={{
            ...styles.tabBtn,
            ...(viewMode === 'full' ? styles.tabBtnActive : {}),
          }}
          onClick={() => setViewMode('full')}
        >
          <Database size={15} />
          <span>Full Schema SQL (All 10 Tables)</span>
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
            Row Level Security (RLS) is enabled on all tables including <code>macro_categories</code> and <code>payment_method_mappings</code>.
          </p>
        </div>

        <div style={styles.archCard}>
          <div style={{ ...styles.archIconBox, backgroundColor: 'var(--primary-light)' }}>
            <Terminal size={18} color="var(--primary)" />
          </div>
          <h3 style={styles.archCardTitle}>Macro Categories Grouping</h3>
          <p style={styles.archCardDesc}>
            Dynamic grouping into Fixed, Variable, and Seasonal categories with UUID foreign key relations.
          </p>
        </div>

        <div style={styles.archCard}>
          <div style={{ ...styles.archIconBox, backgroundColor: 'var(--warning-light)' }}>
            <Key size={18} color="var(--warning)" />
          </div>
          <h3 style={styles.archCardTitle}>Run in Supabase</h3>
          <p style={styles.archCardDesc}>
            1. Click "Open Supabase SQL Editor" above<br />
            2. Click "Copy Active SQL Script" and paste into the editor<br />
            3. Click "RUN" to apply the migration
          </p>
        </div>
      </div>

      {/* SQL Code Box */}
      <div style={styles.codeCard}>
        <div style={styles.codeHeader}>
          <div style={styles.codeLangPill}>
            <Database size={14} color="var(--primary)" />
            <span>PostgreSQL (Supabase SQL)</span>
          </div>
          <span style={styles.codeFilePath}>
            {viewMode === 'migration' ? 'supabase/migrations/20260811_macro_categories.sql' : 'supabase/schema.sql'}
          </span>
        </div>
        <pre style={styles.codeBlock}>
          <code>{activeScript}</code>
        </pre>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  },
  openDashboardBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 16px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    color: 'var(--text-primary)',
    fontSize: '0.8125rem',
    fontWeight: '700',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  copyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 18px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    fontSize: '0.8125rem',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
  },
  tabNav: {
    display: 'flex',
    gap: '10px',
    borderBottom: '1px solid var(--border-main)',
    paddingBottom: '12px',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    color: 'var(--text-secondary)',
    fontSize: '0.8125rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  tabBtnActive: {
    backgroundColor: 'var(--primary)',
    borderColor: 'var(--primary)',
    color: '#FFFFFF',
  },
  architectureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px',
  },
  archCard: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-lg)',
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
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
  },
  codeHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 18px',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderBottom: '1px solid var(--border-main)',
  },
  codeLangPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  codeFilePath: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  codeBlock: {
    margin: 0,
    padding: '20px',
    backgroundColor: '#0F172A',
    color: '#E2E8F0',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8125rem',
    lineHeight: '1.6',
    overflowX: 'auto',
    maxHeight: '600px',
  },
};
