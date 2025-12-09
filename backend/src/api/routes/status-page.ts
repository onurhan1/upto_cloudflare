// Status page management routes

import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../../utils/middleware';
import { generateUUID } from '../../utils/uuid';
import { logAction, getIpAddress, getUserAgent } from '../../utils/audit';

const statusPage = new Hono<{ Bindings: Env }>();

// All routes require authentication
statusPage.use('/*', authMiddleware);

/**
 * GET /status-page/mine
 * Get user's status pages
 */
statusPage.get('/mine', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;

    const pages = await db
      .prepare('SELECT * FROM status_pages WHERE user_id = ? ORDER BY created_at DESC')
      .bind(user.id)
      .all();

    return c.json({ pages: pages.results || [] });
  } catch (error) {
    console.error('Error fetching status pages:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /status-page
 * Create a new status page
 */
statusPage.post('/', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const db = c.env.DB;

    const {
      slug,
      title,
      description,
      is_public = false,
      theme = 'auto',
    } = body;

    if (!slug || !title) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Check if slug is unique
    const existing = await db
      .prepare('SELECT id FROM status_pages WHERE slug = ?')
      .bind(slug)
      .first();

    if (existing) {
      return c.json({ error: 'Slug already exists' }, 409);
    }

    const pageId = generateUUID();
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO status_pages 
        (id, user_id, slug, title, description, is_public, theme, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        pageId,
        user.id,
        slug,
        title,
        description || null,
        is_public ? 1 : 0,
        theme,
        now,
        now
      )
      .run();

    const page = await db
      .prepare('SELECT * FROM status_pages WHERE id = ?')
      .bind(pageId)
      .first();

    // Log status page creation
    await logAction(
      'status_page.create',
      {
        resource_type: 'status_page',
        resource_id: pageId,
        slug,
        title,
      },
      {
        userId: user.id,
        ipAddress: getIpAddress(c.req),
        userAgent: getUserAgent(c.req),
      },
      c.env
    );

    return c.json({ page }, 201);
  } catch (error) {
    console.error('Error creating status page:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /status-page/:id
 * Get status page details
 */
statusPage.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const pageId = c.req.param('id');
    const db = c.env.DB;

    const page = await db
      .prepare('SELECT * FROM status_pages WHERE id = ? AND user_id = ?')
      .bind(pageId, user.id)
      .first();

    if (!page) {
      return c.json({ error: 'Status page not found' }, 404);
    }

    // Get associated services
    const services = await db
      .prepare(
        `SELECT ms.*, sps.display_order 
         FROM status_page_services sps
         JOIN monitored_services ms ON sps.service_id = ms.id
         WHERE sps.status_page_id = ?
         ORDER BY sps.display_order ASC`
      )
      .bind(pageId)
      .all();

    return c.json({
      page,
      services: services.results || [],
    });
  } catch (error) {
    console.error('Error fetching status page:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PATCH /status-page/:id
 * Update status page
 */
statusPage.patch('/:id', async (c) => {
  try {
    const user = c.get('user');
    const pageId = c.req.param('id');
    const body = await c.req.json();
    const db = c.env.DB;

    // Verify ownership
    const existing = await db
      .prepare('SELECT id FROM status_pages WHERE id = ? AND user_id = ?')
      .bind(pageId, user.id)
      .first();

    if (!existing) {
      return c.json({ error: 'Status page not found' }, 404);
    }

    const updates: string[] = [];
    const values: any[] = [];

    const allowedFields = ['title', 'description', 'is_public', 'theme'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(
          field === 'is_public' ? (body[field] ? 1 : 0) : body[field]
        );
      }
    }

    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    updates.push('updated_at = ?');
    values.push(Math.floor(Date.now() / 1000));
    values.push(pageId);

    await db
      .prepare(`UPDATE status_pages SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const page = await db
      .prepare('SELECT * FROM status_pages WHERE id = ?')
      .bind(pageId)
      .first();

    // Log status page update
    await logAction(
      'status_page.update',
      {
        resource_type: 'status_page',
        resource_id: pageId,
        slug: page.slug,
        title: page.title,
        updated_fields: Object.keys(body),
      },
      {
        userId: user.id,
        ipAddress: getIpAddress(c.req),
        userAgent: getUserAgent(c.req),
      },
      c.env
    );

    return c.json({ page });
  } catch (error) {
    console.error('Error updating status page:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /status-page/:id
 * Delete status page
 */
statusPage.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    const pageId = c.req.param('id');
    const db = c.env.DB;

    // Verify ownership
    const existing = await db
      .prepare('SELECT id FROM status_pages WHERE id = ? AND user_id = ?')
      .bind(pageId, user.id)
      .first();

    if (!existing) {
      return c.json({ error: 'Status page not found' }, 404);
    }

    await db.prepare('DELETE FROM status_pages WHERE id = ?').bind(pageId).run();

    return c.json({ message: 'Status page deleted' });
  } catch (error) {
    console.error('Error deleting status page:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /status-page/:id/services
 * Add service to status page
 */
statusPage.post('/:id/services', async (c) => {
  try {
    const user = c.get('user');
    const pageId = c.req.param('id');
    const body = await c.req.json();
    const db = c.env.DB;

    const { service_id, display_order = 0 } = body;

    if (!service_id) {
      return c.json({ error: 'service_id required' }, 400);
    }

    // Verify ownership of both page and service
    const page = await db
      .prepare('SELECT id FROM status_pages WHERE id = ? AND user_id = ?')
      .bind(pageId, user.id)
      .first();

    if (!page) {
      return c.json({ error: 'Status page not found' }, 404);
    }

    const service = await db
      .prepare('SELECT id FROM monitored_services WHERE id = ? AND user_id = ?')
      .bind(service_id, user.id)
      .first();

    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }

    // Check if already added
    const existing = await db
      .prepare(
        'SELECT id FROM status_page_services WHERE status_page_id = ? AND service_id = ?'
      )
      .bind(pageId, service_id)
      .first();

    if (existing) {
      return c.json({ error: 'Service already added to status page' }, 409);
    }

    const id = generateUUID();
    await db
      .prepare(
        'INSERT INTO status_page_services (id, status_page_id, service_id, display_order) VALUES (?, ?, ?, ?)'
      )
      .bind(id, pageId, service_id, display_order)
      .run();

    return c.json({ message: 'Service added to status page' }, 201);
  } catch (error) {
    console.error('Error adding service to status page:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default statusPage;

