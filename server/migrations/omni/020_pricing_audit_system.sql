-- Migration: Add pricing audit system to track all price changes
-- Purpose: Ensure data integrity and compliance
-- Date: 2026-07-11

BEGIN;

-- Create pricing audits table
CREATE TABLE IF NOT EXISTS pricing_audits (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  entity_name TEXT,
  change_type TEXT NOT NULL CHECK (change_type IN ('override', 'bulk_update', 'calculation_discrepancy')),
  old_value NUMERIC(12,2),
  new_value NUMERIC(12,2),
  delta NUMERIC(12,2),
  percentage_change NUMERIC(5,2),
  reason TEXT,
  calculation_hash TEXT,
  calculated_vs_stored_delta NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'discrepancy_flagged', 'resolved')),
  resolved_at TIMESTAMPTZ,
  resolved_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_pricing_audits_user_id ON pricing_audits(user_id);
CREATE INDEX idx_pricing_audits_entity ON pricing_audits(entity_type, entity_id);
CREATE INDEX idx_pricing_audits_change_type ON pricing_audits(change_type);
CREATE INDEX idx_pricing_audits_status ON pricing_audits(status);
CREATE INDEX idx_pricing_audits_created_at ON pricing_audits(created_at DESC);

-- Add comment
COMMENT ON TABLE pricing_audits IS 'Audit trail for all pricing changes, overrides, and discrepancies between frontend/backend calculations';
COMMENT ON COLUMN pricing_audits.change_type IS 'Type of change: override (manual), bulk_update (system), calculation_discrepancy (frontend vs backend mismatch)';
COMMENT ON COLUMN pricing_audits.status IS 'Status of record: recorded (logged), discrepancy_flagged (issue detected), resolved (investigated and fixed)';

COMMIT;
