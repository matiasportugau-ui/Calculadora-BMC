-- PEA M2c — ratchet link persistence (IMP-PEA-13 partial)
-- Apply after 001_pea_core.sql when PEA_ENABLED=1

CREATE TABLE IF NOT EXISTS pea.ratchet_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id UUID NOT NULL REFERENCES pea.gaps(id) ON DELETE CASCADE,
  packet_id UUID NOT NULL REFERENCES pea.evolution_packets(id) ON DELETE CASCADE,
  artifact_type VARCHAR(32) NOT NULL,
  path VARCHAR(512) NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  confirmed_by VARCHAR(128) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pea_ratchet_type_valid CHECK (
    artifact_type IN ('golden', 'fitness_sensor', 'rule_provenance', 'kb_entry', 'adr')
  )
);

CREATE INDEX IF NOT EXISTS pea_ratchet_links_gap_idx ON pea.ratchet_links (gap_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pea_ratchet_links_packet_idx ON pea.ratchet_links (packet_id, created_at DESC);
