// Audit logs API routes

import { Hono } from 'hono';
import { Env } from '../../types';
import { authMiddleware } from '../../utils/middleware';
import { organizationScopeMiddleware } from '../../utils/org-middleware';

const audit = new Hono<{ Bindings: Env }>();

// All routes require authentication
audit.use('/*', authMiddleware);

/**
 * GET /audit
 * Get audit logs for the current organization
 * Query params: action, resource_type, user_id, limit, offset
 */
audit.get('/', organizationScopeMiddleware, async (c) => {
  try {
    const org = c.get('organization');
    const user = c.get('user');
    const db = c.env.DB;

    // Get query parameters
    const action = c.req.query('action');
    const resourceType = c.req.query('resource_type');
    const userId = c.req.query('user_id');
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const startDate = c.req.query('start_date'); // Unix timestamp
    const endDate = c.req.query('end_date'); // Unix timestamp

    // Build query
    let query = `
      SELECT 
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.organization_id = ?
    `;
    const bindParams: any[] = [org.organizationId];

    // Add filters
    if (action) {
      query += ' AND al.action = ?';
      bindParams.push(action);
    }

    if (resourceType) {
      query += ' AND al.resource_type = ?';
      bindParams.push(resourceType);
    }

    if (userId) {
      query += ' AND al.user_id = ?';
      bindParams.push(userId);
    }

    if (startDate) {
      query += ' AND al.created_at >= ?';
      bindParams.push(parseInt(startDate, 10));
    }

    if (endDate) {
      query += ' AND al.created_at <= ?';
      bindParams.push(parseInt(endDate, 10));
    }

    // Order by created_at DESC (newest first)
    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    bindParams.push(limit, offset);

    const result = await db
      .prepare(query)
      .bind(...bindParams)
      .all<{
        id: string;
        user_id?: string;
        organization_id?: string;
        action: string;
        resource_type?: string;
        resource_id?: string;
        metadata: string;
        ip_address?: string;
        user_agent?: string;
        created_at: number;
        user_name?: string;
        user_email?: string;
      }>();

    // Parse metadata JSON
    const logs = (result.results || []).map((log) => ({
      id: log.id,
      user_id: log.user_id,
      user_name: log.user_name,
      user_email: log.user_email,
      organization_id: log.organization_id,
      action: log.action,
      resource_type: log.resource_type,
      resource_id: log.resource_id,
      metadata: log.metadata ? JSON.parse(log.metadata) : {},
      ip_address: log.ip_address,
      user_agent: log.user_agent,
      created_at: log.created_at,
    }));

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE organization_id = ?';
    const countParams: any[] = [org.organizationId];

    if (action) {
      countQuery += ' AND action = ?';
      countParams.push(action);
    }
    if (resourceType) {
      countQuery += ' AND resource_type = ?';
      countParams.push(resourceType);
    }
    if (userId) {
      countQuery += ' AND user_id = ?';
      countParams.push(userId);
    }
    if (startDate) {
      countQuery += ' AND created_at >= ?';
      countParams.push(parseInt(startDate, 10));
    }
    if (endDate) {
      countQuery += ' AND created_at <= ?';
      countParams.push(parseInt(endDate, 10));
    }

    const countResult = await db
      .prepare(countQuery)
      .bind(...countParams)
      .first<{ total: number }>();

    return c.json({
      logs,
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset,
        has_more: (countResult?.total || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default audit;

