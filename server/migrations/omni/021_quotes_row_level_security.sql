-- Migration: Add row-level security (RLS) to quotes table
-- Purpose: Ensure users can only access their own quotes
-- Date: 2026-07-11

BEGIN;

-- Add user_id to quotes table if not already present
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for fast user quote lookup
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_user_created ON quotes(user_id, created_at DESC);

-- Enable RLS on quotes table
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS quotes_select_own ON quotes;
DROP POLICY IF EXISTS quotes_insert_own ON quotes;
DROP POLICY IF EXISTS quotes_update_own ON quotes;
DROP POLICY IF EXISTS quotes_delete_own ON quotes;
DROP POLICY IF EXISTS quotes_admin_all ON quotes;

-- RLS Policy: Users can SELECT their own quotes
CREATE POLICY quotes_select_own ON quotes
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR current_user_is_admin()
  );

-- RLS Policy: Users can INSERT their own quotes
CREATE POLICY quotes_insert_own ON quotes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

-- RLS Policy: Users can UPDATE their own quotes
CREATE POLICY quotes_update_own ON quotes
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR current_user_is_admin()
  )
  WITH CHECK (
    auth.uid() = user_id
    OR current_user_is_admin()
  );

-- RLS Policy: Users can DELETE their own quotes
CREATE POLICY quotes_delete_own ON quotes
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR current_user_is_admin()
  );

-- RLS Policy: Admins have full access
CREATE POLICY quotes_admin_all ON quotes
  FOR ALL
  USING (
    current_user_is_admin()
  )
  WITH CHECK (
    current_user_is_admin()
  );

-- Helper function to check if current user is admin
-- (This should already exist in your auth schema, or create it here)
CREATE OR REPLACE FUNCTION current_user_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Similar RLS for quote_audits table
ALTER TABLE IF EXISTS quote_audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quote_audits_select_own ON quote_audits;
DROP POLICY IF EXISTS quote_audits_admin_all ON quote_audits;

CREATE POLICY quote_audits_select_own ON quote_audits
  FOR SELECT
  USING (
    quote_id IN (
      SELECT id FROM quotes WHERE user_id = auth.uid()
    )
    OR current_user_is_admin()
  );

CREATE POLICY quote_audits_admin_all ON quote_audits
  FOR ALL
  USING (current_user_is_admin());

-- Add comment
COMMENT ON COLUMN quotes.user_id IS 'Owner of the quote. Required for RLS enforcement.';

COMMIT;
