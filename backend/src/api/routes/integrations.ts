// Integrations management routes

import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../../utils/middleware';
import { generateUUID } from '../../utils/uuid';
import { logAction, getIpAddress, getUserAgent } from '../../utils/audit';

const integrations = new Hono<{ Bindings: Env }>();

// All routes require authentication
integrations.use('/*', authMiddleware);

/**
 * GET /integrations
 * Get user's integration settings
 */
integrations.get('/', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;

    let integration = await db
      .prepare('SELECT * FROM integrations WHERE user_id = ?')
      .bind(user.id)
      .first();

    // Create if doesn't exist
    if (!integration) {
      const integrationId = generateUUID();
      const now = Math.floor(Date.now() / 1000);

      await db
        .prepare(
          `INSERT INTO integrations 
          (id, user_id, email_address, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(integrationId, user.id, user.email, 1, now, now)
        .run();

      integration = await db
        .prepare('SELECT * FROM integrations WHERE id = ?')
        .bind(integrationId)
        .first();
    }

    return c.json({ integration });
  } catch (error) {
    console.error('Error fetching integrations:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PATCH /integrations/telegram
 * Update Telegram integration
 */
integrations.patch('/telegram', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const db = c.env.DB;

    const { telegram_chat_id, is_active } = body;

    // Get or create integration
    let integration = await db
      .prepare('SELECT * FROM integrations WHERE user_id = ?')
      .bind(user.id)
      .first();

    if (!integration) {
      const integrationId = generateUUID();
      const now = Math.floor(Date.now() / 1000);

      await db
        .prepare(
          `INSERT INTO integrations 
          (id, user_id, telegram_chat_id, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          integrationId,
          user.id,
          telegram_chat_id || null,
          is_active !== undefined ? (is_active ? 1 : 0) : 1,
          now,
          now
        )
        .run();

      integration = await db
        .prepare('SELECT * FROM integrations WHERE id = ?')
        .bind(integrationId)
        .first();
    } else {
      const updates: string[] = [];
      const values: any[] = [];

      if (telegram_chat_id !== undefined) {
        updates.push('telegram_chat_id = ?');
        values.push(telegram_chat_id || null);
      }

      if (is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(is_active ? 1 : 0);
      }

      if (updates.length > 0) {
        updates.push('updated_at = ?');
        values.push(Math.floor(Date.now() / 1000));
        values.push(integration.id);

        await db
          .prepare(`UPDATE integrations SET ${updates.join(', ')} WHERE id = ?`)
          .bind(...values)
          .run();

        integration = await db
          .prepare('SELECT * FROM integrations WHERE id = ?')
          .bind(integration.id)
          .first();
      }
    }

    // Log integration update
    await logAction(
      'integration.update',
      {
        resource_type: 'integration',
        resource_id: integration.id,
        type: 'telegram',
        updated_fields: Object.keys(body),
      },
      {
        userId: user.id,
        ipAddress: getIpAddress(c.req.raw),
        userAgent: getUserAgent(c.req.raw),
      },
      c.env
    );

    return c.json({ integration });
  } catch (error) {
    console.error('Error updating Telegram integration:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PATCH /integrations/email
 * Update email integration
 */
integrations.patch('/email', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const db = c.env.DB;

    const { email_address, is_active } = body;

    // Get or create integration
    let integration = await db
      .prepare('SELECT * FROM integrations WHERE user_id = ?')
      .bind(user.id)
      .first();

    if (!integration) {
      const integrationId = generateUUID();
      const now = Math.floor(Date.now() / 1000);

      await db
        .prepare(
          `INSERT INTO integrations 
          (id, user_id, email_address, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          integrationId,
          user.id,
          email_address || user.email,
          is_active !== undefined ? (is_active ? 1 : 0) : 1,
          now,
          now
        )
        .run();

      integration = await db
        .prepare('SELECT * FROM integrations WHERE id = ?')
        .bind(integrationId)
        .first();
    } else {
      const updates: string[] = [];
      const values: any[] = [];

      if (email_address !== undefined) {
        updates.push('email_address = ?');
        values.push(email_address);
      }

      if (is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(is_active ? 1 : 0);
      }

      if (updates.length > 0) {
        updates.push('updated_at = ?');
        values.push(Math.floor(Date.now() / 1000));
        values.push(integration.id);

        await db
          .prepare(`UPDATE integrations SET ${updates.join(', ')} WHERE id = ?`)
          .bind(...values)
          .run();

        integration = await db
          .prepare('SELECT * FROM integrations WHERE id = ?')
          .bind(integration.id)
          .first();
      }
    }

    // Log integration update
    await logAction(
      'integration.update',
      {
        resource_type: 'integration',
        resource_id: integration.id,
        type: 'email',
        updated_fields: Object.keys(body),
      },
      {
        userId: user.id,
        ipAddress: getIpAddress(c.req.raw),
        userAgent: getUserAgent(c.req.raw),
      },
      c.env
    );

    return c.json({ integration });
  } catch (error) {
    console.error('Error updating email integration:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default integrations;

