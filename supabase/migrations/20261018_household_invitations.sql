-- ==============================================================================
-- Migration: Household Invitations & Password Reset Tokens (הזמנות חברי משפחה ואיפוס סיסמה)
-- Date: 2026-10-18
-- Description: Manages member invitations via direct links and password reset tokens
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.household_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    token TEXT NOT NULL UNIQUE,
    token_type TEXT NOT NULL DEFAULT 'invite', -- 'invite', 'password_reset'
    invited_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' -- 'pending', 'accepted', 'expired', 'revoked'
);

CREATE INDEX IF NOT EXISTS idx_household_invitations_token 
    ON public.household_invitations(token);

CREATE INDEX IF NOT EXISTS idx_household_invitations_household 
    ON public.household_invitations(household_id);

CREATE INDEX IF NOT EXISTS idx_household_invitations_email 
    ON public.household_invitations(email);

ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.household_invitations TO postgres, anon, authenticated, service_role;

DROP POLICY IF EXISTS "Allow all on household_invitations" ON public.household_invitations;
CREATE POLICY "Allow all on household_invitations"
    ON public.household_invitations FOR ALL
    TO authenticated, anon, service_role, postgres
    USING (true)
    WITH CHECK (true);

-- Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
