// Invitation routes (public - for accepting invitations)

import { Hono } from 'hono';
import { Env } from '../../types';
import { authMiddleware } from '../../utils/middleware';
import { generateUUID } from '../../utils/uuid';

const invitations = new Hono<{ Bindings: Env }>();

/**
 * GET /invitations/:token
 * Get invitation details (public endpoint)
 */
invitations.get('/:token', async (c) => {
  try {
    const token = c.req.param('token');
    const db = c.env.DB;

    const invitation = await db
      .prepare(
        `SELECT i.*, o.name as organization_name, o.slug as organization_slug
         FROM organization_invitations i
         JOIN organizations o ON i.organization_id = o.id
         WHERE i.token = ? AND i.accepted_at IS NULL AND i.expires_at > ?`
      )
      .bind(token, Math.floor(Date.now() / 1000))
      .first();

    if (!invitation) {
      return c.json({ error: 'Invitation not found or expired' }, 404);
    }

    return c.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        organization: {
          id: invitation.organization_id,
          name: invitation.organization_name,
          slug: invitation.organization_slug,
        },
        expiresAt: invitation.expires_at,
      },
    });
  } catch (error) {
    console.error('Error fetching invitation:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /invitations/:token/accept
 * Accept an invitation (requires authentication)
 */
invitations.post('/:token/accept', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const token = c.req.param('token');
    const db = c.env.DB;

    // Get invitation
    const invitation = await db
      .prepare(
        'SELECT * FROM organization_invitations WHERE token = ? AND accepted_at IS NULL AND expires_at > ?'
      )
      .bind(token, Math.floor(Date.now() / 1000))
      .first();

    if (!invitation) {
      return c.json({ error: 'Invitation not found or expired' }, 404);
    }

    // Verify email matches
    if (invitation.email !== user.email) {
      return c.json({ error: 'Invitation email does not match your account email' }, 403);
    }

    // Check if user is already a member
    const existingMember = await db
      .prepare('SELECT id FROM organization_members WHERE organization_id = ? AND user_id = ?')
      .bind(invitation.organization_id, user.id)
      .first();

    if (existingMember) {
      // Mark invitation as accepted anyway
      await db
        .prepare('UPDATE organization_invitations SET accepted_at = ? WHERE id = ?')
        .bind(Math.floor(Date.now() / 1000), invitation.id)
        .run();

      return c.json({
        message: 'You are already a member of this organization',
        organizationId: invitation.organization_id,
      });
    }

    // Add user as member
    const memberId = generateUUID();
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        'INSERT INTO organization_members (id, organization_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(memberId, invitation.organization_id, user.id, invitation.role, now, now)
      .run();

    // Mark invitation as accepted
    await db
      .prepare('UPDATE organization_invitations SET accepted_at = ? WHERE id = ?')
      .bind(now, invitation.id)
      .run();

    return c.json({
      message: 'Invitation accepted successfully',
      organizationId: invitation.organization_id,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default invitations;

