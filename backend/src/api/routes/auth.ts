// Authentication routes

import { Hono } from 'hono';
import { Env } from '../types';
import { generateToken, hashPassword, verifyPassword } from '../../utils/auth';
import { generateUUID } from '../../utils/uuid';
import { logAction, getIpAddress, getUserAgent } from '../../utils/audit';

const auth = new Hono<{ Bindings: Env }>();

/**
 * POST /auth/register
 * Register a new user
 */
auth.post('/register', async (c) => {
  try {
    const { email, password, name } = await c.req.json();

    if (!email || !password || !name) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const db = c.env.DB;

    // Check if user already exists
    const existingUser = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first();

    if (existingUser) {
      return c.json({ error: 'User already exists' }, 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = generateUUID();
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        'INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(userId, email, passwordHash, name, 'user', now, now)
      .run();

    // Create default integration
    const integrationId = generateUUID();
    await db
      .prepare(
        'INSERT INTO integrations (id, user_id, email_address, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(integrationId, userId, email, 1, now, now)
      .run();

    // Create default organization for new user
    const orgId = generateUUID();
    const orgSlug = `${email.split('@')[0]}-org-${orgId.substring(0, 8)}`;
    await db
      .prepare('INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(orgId, `${name}'s Organization`, orgSlug, now, now)
      .run();

    // Add user as owner
    const memberId = generateUUID();
    await db
      .prepare('INSERT INTO organization_members (id, organization_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(memberId, orgId, userId, 'owner', now, now)
      .run();

    // Generate token with default organization
    const token = await generateToken(userId, email, 'user', c.env.JWT_SECRET, orgId);

    return c.json({
      token,
      user: {
        id: userId,
        email,
        name,
        role: 'user',
      },
      organizations: [
        {
          id: orgId,
          name: `${name}'s Organization`,
          slug: orgSlug,
          role: 'owner',
          created_at: now,
        },
      ],
      defaultOrganizationId: orgId,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /auth/login
 * Login and get JWT token
 */
auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email and password required' }, 400);
    }

    const db = c.env.DB;

    // Find user
    const user = await db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first<{
        id: string;
        email: string;
        password_hash: string;
        name: string;
        role: string;
      }>();

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Load user's organizations
    const organizations = await db
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

    // If user has no organizations, create a default one
    let defaultOrgId: string | undefined;
    let orgsList = (organizations.results || []).map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      role: org.member_role,
      created_at: org.created_at,
    }));

    if (orgsList.length === 0) {
      const orgId = generateUUID();
      const orgSlug = `${user.email.split('@')[0]}-org-${orgId.substring(0, 8)}`;
      const now = Math.floor(Date.now() / 1000);

      await db
        .prepare('INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .bind(orgId, `${user.name}'s Organization`, orgSlug, now, now)
        .run();

      // Add user as owner
      const memberId = generateUUID();
      await db
        .prepare('INSERT INTO organization_members (id, organization_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(memberId, orgId, user.id, 'owner', now, now)
        .run();

      defaultOrgId = orgId;
      // Add newly created organization to the list
      orgsList = [
        {
          id: orgId,
          name: `${user.name}'s Organization`,
          slug: orgSlug,
          role: 'owner',
          created_at: now,
        },
      ];
    } else {
      // Use first organization as default
      defaultOrgId = organizations.results?.[0]?.id;
    }

    // Generate token with default organization
    const token = await generateToken(
      user.id,
      user.email,
      user.role,
      c.env.JWT_SECRET,
      defaultOrgId
    );

    // Log login action
    await logAction(
      'user.login',
      {
        resource_type: 'user',
        resource_id: user.id,
        email: user.email,
      },
      {
        userId: user.id,
        organizationId: defaultOrgId,
        ipAddress: getIpAddress(c.req.raw),
        userAgent: getUserAgent(c.req.raw),
      },
      c.env
    );

    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      organizations: orgsList,
      defaultOrganizationId: defaultOrgId,
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default auth;

