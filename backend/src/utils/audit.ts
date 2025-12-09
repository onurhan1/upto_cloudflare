// Audit logging utility
// Logs user activities and system events for compliance and debugging

import { Env } from '../types';
import { generateUUID } from './uuid';

export interface AuditLogMetadata {
  [key: string]: any;
}

export interface AuditLogContext {
  userId?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an action to the audit log
 * @param action - Action name (e.g., 'service.create', 'incident.resolve')
 * @param metadata - Additional metadata about the action
 * @param context - Context information (user, org, IP, user agent)
 * @param env - Environment with database access
 */
export async function logAction(
  action: string,
  metadata: AuditLogMetadata = {},
  context: AuditLogContext,
  env: Env
): Promise<void> {
  try {
    const db = env.DB;
    const logId = generateUUID();
    const now = Math.floor(Date.now() / 1000);

    // Parse metadata to JSON string
    const metadataJson = JSON.stringify(metadata);

    await db
      .prepare(
        `INSERT INTO audit_logs 
        (id, user_id, organization_id, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        logId,
        context.userId || null,
        context.organizationId || null,
        action,
        metadata.resource_type || null,
        metadata.resource_id || null,
        metadataJson,
        context.ipAddress || null,
        context.userAgent || null,
        now
      )
      .run();
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('Error logging audit action:', error);
  }
}

/**
 * Extract IP address from request
 */
export function getIpAddress(request: Request): string | undefined {
  // Check CF-Connecting-IP header (Cloudflare)
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp) return cfIp;

  // Check X-Forwarded-For header
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return xForwardedFor.split(',')[0].trim();
  }

  // Check X-Real-IP header
  const xRealIp = request.headers.get('X-Real-IP');
  if (xRealIp) return xRealIp;

  return undefined;
}

/**
 * Extract user agent from request
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('User-Agent') || undefined;
}

