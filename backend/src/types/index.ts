// Type definitions for Upto Backend

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'admin' | 'user' | 'readonly';
  created_at: number;
  updated_at: number;
}

export interface MonitoredService {
  id: string;
  user_id: string;
  organization_id: string | null;
  project_id: string | null;
  name: string;
  type: 'http' | 'ping' | 'dns' | 'ssl' | 'domain' | 'api';
  url_or_host: string;
  port: number | null;
  check_interval_seconds: number;
  timeout_ms: number;
  expected_status_code: number | null;
  expected_keyword: string | null;
  is_active: boolean;
  notify_telegram: boolean;
  notify_email: boolean;
  created_at: number;
  updated_at: number;
}

export interface ServiceCheck {
  id: string;
  service_id: string;
  status: 'up' | 'down' | 'degraded';
  response_time_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  checked_at: number;
  anomaly_detected?: boolean;
  anomaly_type?: 'spike' | 'slowdown' | 'unknown' | null;
  anomaly_score?: number | null;
}

export interface Incident {
  id: string;
  service_id: string;
  status: 'open' | 'monitoring' | 'resolved';
  title: string;
  description: string | null;
  started_at: number;
  resolved_at: number | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
  ai_summary?: string | null;
}

export interface IncidentUpdate {
  id: string;
  incident_id: string;
  message: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  created_at: number;
}

export interface Integration {
  id: string;
  user_id: string;
  telegram_chat_id: string | null;
  email_address: string | null;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export interface StatusPage {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  is_public: boolean;
  theme: 'light' | 'dark' | 'auto';
  created_at: number;
  updated_at: number;
}

export interface StatusPageService {
  id: string;
  status_page_id: string;
  service_id: string;
  display_order: number;
}

export interface UserApiKey {
  id: string;
  user_id: string;
  api_provider: 'openai' | 'anthropic' | 'google' | 'azure';
  api_key_encrypted: string;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: number;
  updated_at: number;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  created_at: number;
  updated_at: number;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
}

export interface ProjectService {
  id: string;
  project_id: string;
  service_id: string;
  created_at: number;
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  token: string;
  invited_by: string | null;
  expires_at: number;
  accepted_at: number | null;
  created_at: number;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  organization_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  metadata: string; // JSON string
  ip_address?: string;
  user_agent?: string;
  created_at: number;
}

export interface Env {
  DB: D1Database;
  STATUS_SNAPSHOTS: KVNamespace;
  STATUS_PAGE_CACHE: KVNamespace;
  SERVICE_STATE: DurableObjectNamespace;
  MONITORING_QUEUE: Queue;
  STATIC_ASSETS: R2Bucket;
  RATE_LIMIT_KV?: KVNamespace;
  ENVIRONMENT: string;
  JWT_SECRET: string;
  TELEGRAM_BOT_TOKEN: string;
  MAILCHANNELS_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  APPLE_CLIENT_ID: string;
  APPLE_TEAM_ID: string;
  APPLE_KEY_ID: string;
  APPLE_PRIVATE_KEY: string;
  OPENAI_API_KEY?: string;
  ENCRYPTION_KEY?: string; // Encryption key for API keys (256-bit, base64 encoded)
  FRONTEND_URL: string;
}

export interface ServiceState {
  serviceId: string;
  currentStatus: 'up' | 'down' | 'degraded';
  recentChecks: Array<{
    timestamp: number;
    status: 'up' | 'down' | 'degraded';
  }>;
  openIncidentId: string | null;
  lastCheckAt: number;
}

export interface MonitoringJob {
  service_id: string;
  type: MonitoredService['type'];
  url_or_host: string;
  port: number | null;
  timeout_ms: number;
  expected_status_code: number | null;
  expected_keyword: string | null;
}

