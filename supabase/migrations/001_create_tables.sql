-- FireClaw Community Threat Feed — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Community threat detections (anonymized)
CREATE TABLE IF NOT EXISTS detections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid NOT NULL,
  timestamp timestamptz DEFAULT now(),
  domain text NOT NULL,
  tier text NOT NULL,
  detections_count int DEFAULT 0,
  severity int DEFAULT 0,
  severity_level text,
  flagged boolean DEFAULT false,
  duration_ms int,
  patterns_matched text[],
  created_at timestamptz DEFAULT now()
);

-- Sharing preferences
CREATE TABLE IF NOT EXISTS sharing_preferences (
  instance_id uuid PRIMARY KEY,
  share_data boolean DEFAULT false,
  version text,
  updated_at timestamptz DEFAULT now()
);

-- Community blocklist (aggregated)
CREATE TABLE IF NOT EXISTS community_blocklist (
  domain text PRIMARY KEY,
  total_detections int DEFAULT 0,
  total_flags int DEFAULT 0,
  avg_severity float DEFAULT 0,
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  reporters int DEFAULT 1
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_detections_domain ON detections(domain);
CREATE INDEX IF NOT EXISTS idx_detections_timestamp ON detections(timestamp);
CREATE INDEX IF NOT EXISTS idx_detections_instance ON detections(instance_id);

-- RLS
ALTER TABLE detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharing_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_blocklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_detections" ON detections FOR INSERT WITH CHECK (true);
CREATE POLICY "read_detections" ON detections FOR SELECT USING (true);
CREATE POLICY "read_blocklist" ON community_blocklist FOR SELECT USING (true);
CREATE POLICY "manage_sharing" ON sharing_preferences FOR ALL USING (true);
