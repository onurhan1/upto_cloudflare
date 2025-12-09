-- Upto Cloudflare D1 Database Schema
-- Initial migration

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user', 'readonly')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Monitored services table
CREATE TABLE IF NOT EXISTS monitored_services (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('http', 'ping', 'dns', 'ssl', 'domain', 'api')),
  url_or_host TEXT NOT NULL,
  port INTEGER,
  check_interval_seconds INTEGER NOT NULL DEFAULT 60,
  timeout_ms INTEGER NOT NULL DEFAULT 5000,
  expected_status_code INTEGER,
  expected_keyword TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notify_telegram INTEGER NOT NULL DEFAULT 0,
  notify_email INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Service checks table (health check results)
CREATE TABLE IF NOT EXISTS service_checks (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('up', 'down', 'degraded')),
  response_time_ms INTEGER,
  status_code INTEGER,
  error_message TEXT,
  checked_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (service_id) REFERENCES monitored_services(id) ON DELETE CASCADE
);

-- Incidents table
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'monitoring', 'resolved')),
  title TEXT NOT NULL,
  description TEXT,
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at INTEGER,
  created_by TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (service_id) REFERENCES monitored_services(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Incident updates table
CREATE TABLE IF NOT EXISTS incident_updates (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- Integrations table (Telegram, Email settings)
CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  telegram_chat_id TEXT,
  email_address TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id)
);

-- Status pages table
CREATE TABLE IF NOT EXISTS status_pages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT 'auto' CHECK(theme IN ('light', 'dark', 'auto')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Status page services (many-to-many relationship)
CREATE TABLE IF NOT EXISTS status_page_services (
  id TEXT PRIMARY KEY,
  status_page_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (status_page_id) REFERENCES status_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES monitored_services(id) ON DELETE CASCADE,
  UNIQUE(status_page_id, service_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_monitored_services_user_id ON monitored_services(user_id);
CREATE INDEX IF NOT EXISTS idx_monitored_services_is_active ON monitored_services(is_active);
CREATE INDEX IF NOT EXISTS idx_service_checks_service_id ON service_checks(service_id);
CREATE INDEX IF NOT EXISTS idx_service_checks_checked_at ON service_checks(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_service_id ON incidents(service_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incident_updates_incident_id ON incident_updates(incident_id);
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_status_pages_slug ON status_pages(slug);
CREATE INDEX IF NOT EXISTS idx_status_page_services_status_page_id ON status_page_services(status_page_id);

