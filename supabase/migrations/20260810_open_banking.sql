-- ==============================================================================
-- Migration: Open Banking Integration Infrastructure
-- Description: Adds Bank_Accounts table, source_reference_id deduplication index,
--              and bank_account_id foreign key on transactions.
-- Date: 2026-08-10
-- ==============================================================================

-- 1. Create Bank_Accounts Table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    provider_name TEXT NOT NULL, -- e.g. 'Bank Leumi', 'Bank Hapoalim', 'Max', 'Isracard'
    account_number_masked TEXT NOT NULL, -- e.g. '**** 4892'
    account_type TEXT NOT NULL DEFAULT 'checking' CHECK (account_type IN ('checking', 'credit_card', 'savings', 'investment')),
    currency TEXT NOT NULL DEFAULT 'ILS',
    current_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    sync_status TEXT NOT NULL DEFAULT 'active' CHECK (sync_status IN ('active', 'syncing', 'error', 'disconnected')),
    last_synced_at TIMESTAMPTZ,
    auth_token_ref TEXT, -- Reference identifier for encrypted credentials in vault/KMS
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add Indexes on Bank_Accounts
CREATE INDEX IF NOT EXISTS idx_bank_accounts_household ON public.bank_accounts(household_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_provider ON public.bank_accounts(provider_name);

-- 3. Enable Row Level Security (RLS) on Bank_Accounts
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bank accounts in their households"
    ON public.bank_accounts FOR SELECT
    USING (public.is_household_member(household_id));

CREATE POLICY "Users can insert bank accounts in their households"
    ON public.bank_accounts FOR INSERT
    WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "Users can update bank accounts in their households"
    ON public.bank_accounts FOR UPDATE
    USING (public.is_household_member(household_id))
    WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "Users can delete bank accounts in their households"
    ON public.bank_accounts FOR DELETE
    USING (public.is_household_member(household_id));

-- 4. Add Open Banking Columns to Transactions Table
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS source_reference_id TEXT,
    ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- 5. Partial Unique Index to guarantee Idempotency and Prevent Duplicates
-- Ensures no duplicate transactions are inserted for the same external reference ID within a household
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_household_source_ref 
    ON public.transactions (household_id, source_reference_id)
    WHERE source_reference_id IS NOT NULL;

-- 6. Trigger for bank_accounts updated_at
CREATE OR REPLACE TRIGGER update_bank_accounts_modtime
    BEFORE UPDATE ON public.bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
