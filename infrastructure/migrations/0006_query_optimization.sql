-- Migration: Query Optimization & Index Tuning
-- Adds composite indexes for better query performance

-- Composite index for service_checks: service_id + checked_at (for ORDER BY queries)
CREATE INDEX IF NOT EXISTS idx_service_checks_service_checked 
ON service_checks(service_id, checked_at DESC);

-- Composite index for service_checks: service_id + status + response_time_ms (for anomaly detection)
CREATE INDEX IF NOT EXISTS idx_service_checks_service_status_response 
ON service_checks(service_id, status, response_time_ms) 
WHERE response_time_ms IS NOT NULL AND status = 'up';

-- Composite index for incidents: service_id + status + started_at (for filtering and sorting)
CREATE INDEX IF NOT EXISTS idx_incidents_service_status_started 
ON incidents(service_id, status, started_at DESC);

-- Index for monitored_services: organization_id + is_active (for filtering active services by org)
CREATE INDEX IF NOT EXISTS idx_monitored_services_org_active 
ON monitored_services(organization_id, is_active) 
WHERE is_active = 1;

-- Index for monitored_services: project_id + is_active (for filtering active services by project)
CREATE INDEX IF NOT EXISTS idx_monitored_services_project_active 
ON monitored_services(project_id, is_active) 
WHERE is_active = 1;

-- Composite index for incidents with organization scope (for multitenancy)
-- This will be used when joining with monitored_services that have organization_id
CREATE INDEX IF NOT EXISTS idx_incidents_service_started 
ON incidents(service_id, started_at DESC);

