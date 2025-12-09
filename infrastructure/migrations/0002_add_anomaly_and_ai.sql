-- Migration: Add anomaly detection and AI fields
-- Adds anomaly detection fields to service_checks and AI summary to incidents

-- Add anomaly detection fields to service_checks table
ALTER TABLE service_checks ADD COLUMN anomaly_detected INTEGER NOT NULL DEFAULT 0;
ALTER TABLE service_checks ADD COLUMN anomaly_type TEXT CHECK(anomaly_type IN ('spike', 'slowdown', 'unknown'));
ALTER TABLE service_checks ADD COLUMN anomaly_score REAL;

-- Add AI summary field to incidents table
ALTER TABLE incidents ADD COLUMN ai_summary TEXT;

