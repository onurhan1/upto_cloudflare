// Public routes (no authentication required)

import { Hono } from 'hono';
import { Env } from '../../types';

const publicRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /public/status/:slug
 * Public status page data (JSON)
 */
publicRoutes.get('/status/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const db = c.env.DB;
    const cache = c.env.STATUS_PAGE_CACHE;

    // Try cache first
    const cached = await cache.get(`status_page:${slug}`);
    if (cached) {
      return c.json(JSON.parse(cached));
    }

    // Get status page
    const page = await db
      .prepare('SELECT * FROM status_pages WHERE slug = ? AND is_public = 1')
      .bind(slug)
      .first();

    if (!page) {
      return c.json({ error: 'Status page not found' }, 404);
    }

    // Get services
    const services = await db
      .prepare(
        `SELECT ms.*, sps.display_order 
         FROM status_page_services sps
         JOIN monitored_services ms ON sps.service_id = ms.id
         WHERE sps.status_page_id = ?
         ORDER BY sps.display_order ASC`
      )
      .bind(page.id)
      .all();

    // Get service statuses from KV
    const statusSnapshots = c.env.STATUS_SNAPSHOTS;
    const serviceStatuses: any[] = [];

    for (const service of services.results || []) {
      const snapshot = await statusSnapshots.get(`service:${service.id}`);
      if (snapshot) {
        serviceStatuses.push({
          ...service,
          status: JSON.parse(snapshot),
        });
      } else {
        serviceStatuses.push({
          ...service,
          status: { current: 'unknown', lastCheck: null },
        });
      }
    }

    // Get recent incidents
    const incidents = await db
      .prepare(
        `SELECT i.*, ms.name as service_name 
         FROM incidents i
         JOIN monitored_services ms ON i.service_id = ms.id
         JOIN status_page_services sps ON ms.id = sps.service_id
         WHERE sps.status_page_id = ? AND i.status != 'resolved'
         ORDER BY i.started_at DESC
         LIMIT 10`
      )
      .bind(page.id)
      .all();

    // Get last 5 activity events for this organization or user
    let recentActivity: any[] = [];
    try {
      // Try to get organization_id from services
      const firstService = services.results?.[0];
      if (firstService) {
        const serviceOrg = await db
          .prepare('SELECT organization_id FROM monitored_services WHERE id = ?')
          .bind(firstService.id)
          .first<{ organization_id?: string }>();

        if (serviceOrg?.organization_id) {
          const activityLogs = await db
            .prepare(
              `SELECT 
                al.*,
                u.name as user_name
              FROM audit_logs al
              LEFT JOIN users u ON al.user_id = u.id
              WHERE al.organization_id = ?
              ORDER BY al.created_at DESC
              LIMIT 5`
            )
            .bind(serviceOrg.organization_id)
            .all<{
              id: string;
              action: string;
              resource_type?: string;
              metadata: string;
              created_at: number;
              user_name?: string;
            }>();

          recentActivity = (activityLogs.results || []).map((log) => ({
            id: log.id,
            action: log.action,
            resource_type: log.resource_type,
            metadata: log.metadata ? JSON.parse(log.metadata) : {},
            created_at: log.created_at,
            user_name: log.user_name,
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      // Don't fail the request if activity fetch fails
    }

    const response = {
      page: {
        id: page.id,
        slug: page.slug,
        title: page.title,
        description: page.description,
        theme: page.theme,
      },
      services: serviceStatuses,
      incidents: incidents.results || [],
      recent_activity: recentActivity,
      updatedAt: new Date().toISOString(),
    };

    // Cache for 1 minute
    await cache.put(`status_page:${slug}`, JSON.stringify(response), {
      expirationTtl: 60,
    });

    return c.json(response);
  } catch (error) {
    console.error('Error fetching public status:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /health
 * Health check endpoint
 */
publicRoutes.get('/health', async (c) => {
  try {
    const db = c.env.DB;

    // Simple DB check
    await db.prepare('SELECT 1').first();

    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT || 'unknown',
    });
  } catch (error) {
    return c.json(
      {
        status: 'error',
        error: 'Database connection failed',
        timestamp: new Date().toISOString(),
      },
      503
    );
  }
});

export default publicRoutes;

