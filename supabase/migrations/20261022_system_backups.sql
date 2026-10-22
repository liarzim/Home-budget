-- ==============================================================================
-- Migration: System Backups & Household Restore Management
-- Date: 2026-10-22
-- Description: Manages automated nightly backups, retention policies, and per-household restore points
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.system_backups (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    date DATE NOT NULL,
    type TEXT NOT NULL DEFAULT 'scheduled_nightly', -- 'scheduled_nightly', 'manual'
    household_id TEXT NOT NULL DEFAULT 'all', -- 'all' for full system, or specific household UUID
    household_name TEXT NOT NULL DEFAULT 'כלל המשפחות',
    total_rows INTEGER NOT NULL DEFAULT 0,
    file_size_kb NUMERIC NOT NULL DEFAULT 0,
    tables_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    backup_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'failed', 'restoring'
    retention_days INTEGER NOT NULL DEFAULT 30
);

CREATE INDEX IF NOT EXISTS idx_system_backups_date 
    ON public.system_backups(date DESC);

CREATE INDEX IF NOT EXISTS idx_system_backups_household 
    ON public.system_backups(household_id);

ALTER TABLE public.system_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on system_backups" ON public.system_backups;
CREATE POLICY "Allow all on system_backups"
    ON public.system_backups FOR ALL
    TO authenticated, anon, service_role, postgres
    USING (true)
    WITH CHECK (true);

GRANT ALL ON TABLE public.system_backups TO postgres, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
