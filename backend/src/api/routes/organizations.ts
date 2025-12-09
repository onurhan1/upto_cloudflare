// Organizations routes

import { Hono } from 'hono';
import { Env } from '../../types';
import { authMiddleware } from '../../utils/middleware';
import { organizationScopeMiddleware, requireOrgRole } from '../../utils/org-middleware';
import { generateUUID } from '../../utils/uuid';

const organizations = new Hono<{ Bindings: Env }>();

// All routes require authentication
organizations.use('/*', authMiddleware);

/**
 * GET /organizations
 * Get user's organizations
 */
organizations.get('/', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;

    const orgs = await db
      .prepare(
        `SELECT o.*, om.role as member_role
         FROM organizations o
         JOIN organization_members om ON o.id = om.organization_id
         WHERE om.user_id = ?
         ORDER BY o.created_at ASC`
      )
      .bind(user.id)
      .all<{
        id: string;
        name: string;
        slug: string;
        created_at: number;
        updated_at: number;
        member_role: string;
      }>();

    return c.json({
      organizations: (orgs.results || []).map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: org.member_role,
        created_at: org.created_at,
        updated_at: org.updated_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /organizations
 * Create a new organization
 */
organizations.post('/', async (c) => {
  try {
    const user = c.get('user');
    const { name, slug: providedSlug } = await c.req.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return c.json({ error: 'Organization name is required' }, 400);
    }

    const db = c.env.DB;
    const orgId = generateUUID();
    
    // Use provided slug or generate one
    let slug = providedSlug;
    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
      slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + `-${orgId.substring(0, 8)}`;
    } else {
      slug = providedSlug.trim().toLowerCase();
    }
    
    // Check if slug already exists
    const existingOrg = await db
      .prepare('SELECT id FROM organizations WHERE slug = ?')
      .bind(slug)
      .first();
    
    if (existingOrg) {
      // Append unique suffix if slug exists
      slug = `${slug}-${orgId.substring(0, 8)}`;
    }
    
    const now = Math.floor(Date.now() / 1000);

    // Create organization
    await db
      .prepare('INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(orgId, name.trim(), slug, now, now)
      .run();

    // Add creator as owner
    const memberId = generateUUID();
    await db
      .prepare('INSERT INTO organization_members (id, organization_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(memberId, orgId, user.id, 'owner', now, now)
      .run();

    return c.json({
      organization: {
        id: orgId,
        name: name.trim(),
        slug,
        role: 'owner',
        created_at: now,
        updated_at: now,
      },
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /organizations/:id
 * Get organization details
 */
organizations.get('/:id', organizationScopeMiddleware, async (c) => {
  try {
    const org = c.get('organization');
    const db = c.env.DB;

    const organization = await db
      .prepare('SELECT * FROM organizations WHERE id = ?')
      .bind(org.organizationId)
      .first();

    if (!organization) {
      return c.json({ error: 'Organization not found' }, 404);
    }

    // Get members
    const members = await db
      .prepare(
        `SELECT u.id, u.email, u.name, om.role, om.created_at
         FROM organization_members om
         JOIN users u ON om.user_id = u.id
         WHERE om.organization_id = ?
         ORDER BY om.created_at ASC`
      )
      .bind(org.organizationId)
      .all();

    return c.json({
      organization,
      members: members.results || [],
      currentUserRole: org.organizationRole,
    });
  } catch (error) {
    console.error('Error fetching organization:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /organizations/:id/invite
 * Invite a user to the organization
 */
organizations.post('/:id/invite', organizationScopeMiddleware, requireOrgRole('owner', 'admin'), async (c) => {
  try {
    const org = c.get('organization');
    const user = c.get('user');
    const { email, role = 'member' } = await c.req.json();

    if (!email || typeof email !== 'string') {
      return c.json({ error: 'Email is required' }, 400);
    }

    const validRoles = ['owner', 'admin', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    // Only owners can invite owners/admins
    if ((role === 'owner' || role === 'admin') && org.organizationRole !== 'owner') {
      return c.json({ error: 'Only owners can invite owners and admins' }, 403);
    }

    const db = c.env.DB;

    // Check if user is already a member
    const existingMember = await db
      .prepare('SELECT id FROM organization_members WHERE organization_id = ? AND user_id = (SELECT id FROM users WHERE email = ?)')
      .bind(org.organizationId, email)
      .first();

    if (existingMember) {
      return c.json({ error: 'User is already a member of this organization' }, 409);
    }

    // Check if there's a pending invitation
    const existingInvite = await db
      .prepare('SELECT id FROM organization_invitations WHERE organization_id = ? AND email = ? AND accepted_at IS NULL AND expires_at > ?')
      .bind(org.organizationId, email, Math.floor(Date.now() / 1000))
      .first();

    if (existingInvite) {
      return c.json({ error: 'Invitation already sent' }, 409);
    }

    // Generate invitation token
    const inviteId = generateUUID();
    const token = generateUUID();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 60 * 60 * 24 * 7; // 7 days

    // Check if organization_invitations table exists, if not create it
    try {
      const tableCheck = await db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='organization_invitations'")
        .first();
      
      if (!tableCheck) {
        // Create the table if it doesn't exist
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS organization_invitations (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            email TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member', 'viewer')),
            token TEXT UNIQUE NOT NULL,
            invited_by TEXT,
            expires_at INTEGER NOT NULL,
            accepted_at INTEGER,
            created_at INTEGER NOT NULL DEFAULT (unixepoch()),
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL
          )
        `).run();
        
        // Create indexes
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_organization_invitations_token ON organization_invitations(token)').run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_organization_invitations_org_id ON organization_invitations(organization_id)').run();
        
        console.log('Created organization_invitations table on-the-fly');
      }
    } catch (tableError: any) {
      console.error('Error checking/creating organization_invitations table:', tableError);
      // Continue anyway - migration should handle this
    }

    await db
      .prepare(
        `INSERT INTO organization_invitations 
        (id, organization_id, email, role, token, invited_by, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(inviteId, org.organizationId, email, role, token, user.id, expiresAt, now)
      .run();

    // Send invitation email with link
    const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteLink = `${frontendUrl}/invitations/${token}`;
    
    try {
      // Send email via MailChannels (if configured)
      if (c.env.MAILCHANNELS_API_KEY) {
        const emailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.MAILCHANNELS_API_KEY}`,
          },
          body: JSON.stringify({
            personalizations: [
              {
                to: [{ email }],
              },
            ],
            from: {
              email: c.env.FROM_EMAIL || 'noreply@upto.app',
              name: 'Upto Security Monitoring',
            },
            subject: `Invitation to join ${org.organizationName}`,
            content: [
              {
                type: 'text/html',
                value: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta charset="utf-8">
                    <style>
                      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                      .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                      .footer { margin-top: 30px; font-size: 12px; color: #666; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <h2>You've been invited to join ${org.organizationName}</h2>
                      <p>You've been invited to join <strong>${org.organizationName}</strong> on Upto Security Monitoring.</p>
                      <p>Your role will be: <strong>${role}</strong></p>
                      <p>
                        <a href="${inviteLink}" class="button">Accept Invitation</a>
                      </p>
                      <p>Or copy and paste this link into your browser:</p>
                      <p style="word-break: break-all; color: #007bff;">${inviteLink}</p>
                      <p>This invitation will expire in 7 days.</p>
                      <div class="footer">
                        <p>If you didn't expect this invitation, you can safely ignore this email.</p>
                      </div>
                    </div>
                  </body>
                  </html>
                `,
              },
            ],
          }),
        });

        if (!emailResponse.ok) {
          console.warn('Failed to send invitation email:', await emailResponse.text());
        }
      } else {
        console.log('MailChannels not configured, skipping email send');
      }
    } catch (emailError) {
      console.error('Error sending invitation email:', emailError);
      // Don't fail the request if email fails
    }

    return c.json({
      invitation: {
        id: inviteId,
        email,
        role,
        token,
        inviteLink, // Return for testing/debugging
        expiresAt,
      },
      message: 'Invitation sent successfully',
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /organizations/:id/invitations
 * Get pending invitations
 */
organizations.get('/:id/invitations', organizationScopeMiddleware, requireOrgRole('owner', 'admin'), async (c) => {
  try {
    const org = c.get('organization');
    const db = c.env.DB;

    const invitations = await db
      .prepare(
        `SELECT i.*, u.name as invited_by_name
         FROM organization_invitations i
         LEFT JOIN users u ON i.invited_by = u.id
         WHERE i.organization_id = ? AND i.accepted_at IS NULL AND i.expires_at > ?
         ORDER BY i.created_at DESC`
      )
      .bind(org.organizationId, Math.floor(Date.now() / 1000))
      .all();

    return c.json({
      invitations: invitations.results || [],
    });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default organizations;

