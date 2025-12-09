// Incidents management routes

import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../../utils/middleware';
import { organizationScopeMiddleware } from '../../utils/org-middleware';
import { generateUUID } from '../../utils/uuid';
import { logAction, getIpAddress, getUserAgent } from '../../utils/audit';

const incidents = new Hono<{ Bindings: Env }>();

// All routes require authentication
incidents.use('/*', authMiddleware);

/**
 * GET /incidents
 * List incidents (filterable by service_id, status)
 * Optimized with organization scope and proper indexes
 */
incidents.get('/', organizationScopeMiddleware, async (c) => {
  try {
    const org = c.get('organization');
    const serviceId = c.req.query('service_id');
    const status = c.req.query('status');
    const db = c.env.DB;

    // Optimized query with organization scope and proper index usage
    let query = `
      SELECT i.*, ms.name as service_name 
      FROM incidents i
      JOIN monitored_services ms ON i.service_id = ms.id
      WHERE ms.organization_id = ?
    `;
    const params: any[] = [org.organizationId];

    if (serviceId) {
      query += ' AND i.service_id = ?';
      params.push(serviceId);
    }

    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }

    query += ' ORDER BY i.started_at DESC LIMIT 100';

    const result = await db.prepare(query).bind(...params).all();

    return c.json({ incidents: result.results || [] });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /incidents/:id
 * Get incident details with updates
 */
incidents.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const incidentId = c.req.param('id');
    const db = c.env.DB;

    // Verify ownership through service
    const incident = await db
      .prepare(
        `SELECT i.*, ms.name as service_name 
         FROM incidents i
         JOIN monitored_services ms ON i.service_id = ms.id
         WHERE i.id = ? AND ms.user_id = ?`
      )
      .bind(incidentId, user.id)
      .first();

    if (!incident) {
      return c.json({ error: 'Incident not found' }, 404);
    }

    // Get updates
    const updates = await db
      .prepare(
        'SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at ASC'
      )
      .bind(incidentId)
      .all();

    return c.json({
      incident,
      updates: updates.results || [],
    });
  } catch (error) {
    console.error('Error fetching incident:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /incidents
 * Create a new incident
 */
incidents.post('/', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const db = c.env.DB;

    const { service_id, title, description, status = 'open' } = body;

    if (!service_id || !title) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Verify service ownership
    const service = await db
      .prepare('SELECT id FROM monitored_services WHERE id = ? AND user_id = ?')
      .bind(service_id, user.id)
      .first();

    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }

    const incidentId = generateUUID();
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO incidents 
        (id, service_id, status, title, description, started_at, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        incidentId,
        service_id,
        status,
        title,
        description || null,
        now,
        user.id,
        now,
        now
      )
      .run();

    // Create initial update
    const updateId = generateUUID();
    await db
      .prepare(
        'INSERT INTO incident_updates (id, incident_id, message, status, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(updateId, incidentId, title, status, now)
      .run();

    const incident = await db
      .prepare('SELECT * FROM incidents WHERE id = ?')
      .bind(incidentId)
      .first();

    return c.json({ incident }, 201);
  } catch (error) {
    console.error('Error creating incident:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PATCH /incidents/:id
 * Update incident status or add update
 */
incidents.patch('/:id', async (c) => {
  try {
    const user = c.get('user');
    const incidentId = c.req.param('id');
    const body = await c.req.json();
    const db = c.env.DB;

    // Verify ownership
    const existing = await db
      .prepare(
        `SELECT i.* FROM incidents i
         JOIN monitored_services ms ON i.service_id = ms.id
         WHERE i.id = ? AND ms.user_id = ?`
      )
      .bind(incidentId, user.id)
      .first();

    if (!existing) {
      return c.json({ error: 'Incident not found' }, 404);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);

      if (body.status === 'resolved') {
        updates.push('resolved_at = ?');
        values.push(Math.floor(Date.now() / 1000));
      }
    }

    if (body.title !== undefined) {
      updates.push('title = ?');
      values.push(body.title);
    }

    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(Math.floor(Date.now() / 1000));
      values.push(incidentId);

      await db
        .prepare(`UPDATE incidents SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();
    }

    // Add update if message provided
    if (body.message) {
      const updateId = generateUUID();
      await db
        .prepare(
          'INSERT INTO incident_updates (id, incident_id, message, status, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(
          updateId,
          incidentId,
          body.message,
          body.status || existing.status,
          Math.floor(Date.now() / 1000)
        )
        .run();
    }

    const incident = await db
      .prepare('SELECT * FROM incidents WHERE id = ?')
      .bind(incidentId)
      .first();

    // Log incident update/resolve
    const action = body.status === 'resolved' ? 'incident.resolve' : 'incident.update';
    await logAction(
      action,
      {
        resource_type: 'incident',
        resource_id: incidentId,
        service_id: existing.service_id,
        status: body.status || existing.status,
        title: existing.title,
      },
      {
        userId: user.id,
        ipAddress: getIpAddress(c.req),
        userAgent: getUserAgent(c.req),
      },
      c.env
    );

    return c.json({ incident });
  } catch (error) {
    console.error('Error updating incident:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default incidents;

