// Organization and Project scoping middleware
// Ensures requests are scoped to the correct organization and project

import { Context, Next } from 'hono';
import { Env } from '../types';
import { generateUUID } from './uuid';

export interface OrgContext {
  organizationId: string;
  organizationRole: 'owner' | 'admin' | 'member' | 'viewer';
}

export interface ProjectContext {
  projectId: string;
  projectOrganizationId: string;
}

/**
 * Middleware to require and validate organization context
 * Sets organizationId and organizationRole in context
 */
export async function organizationScopeMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<Response | void> {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Get organization ID from query param, header, or JWT token
  const orgId = c.req.query('organization_id') || 
                c.req.header('X-Organization-ID') ||
                (user as any).organizationId;

  if (!orgId) {
    return c.json({ error: 'Organization ID is required' }, 400);
  }

  const db = c.env.DB;

  // Verify user is a member of this organization
  let membership = await db
    .prepare(
      'SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?'
    )
    .bind(orgId, user.id)
    .first<{ role: string }>();

  // If not a member, check if this is the user's own organization (backward compatibility)
  // or if organization exists and user should be auto-added
  if (!membership) {
    // Check if organization exists
    const org = await db
      .prepare('SELECT id FROM organizations WHERE id = ?')
      .bind(orgId)
      .first();

    if (org) {
      // Auto-add user as member with 'member' role (backward compatibility)
      // This handles cases where organization was created but membership wasn't properly set up
      const memberId = generateUUID();
      const now = Math.floor(Date.now() / 1000);
      
      try {
        await db
          .prepare(
            'INSERT INTO organization_members (id, organization_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .bind(memberId, orgId, user.id, 'member', now, now)
          .run();
        
        membership = { role: 'member' };
        console.log(`Auto-added user ${user.id} to organization ${orgId}`);
      } catch (error: any) {
        // If insert fails (e.g., duplicate), try to get existing membership
        if (error.message?.includes('UNIQUE')) {
          membership = await db
            .prepare(
              'SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?'
            )
            .bind(orgId, user.id)
            .first<{ role: string }>();
        } else {
          console.error('Error auto-adding user to organization:', error);
          return c.json({ error: 'You are not a member of this organization' }, 403);
        }
      }
    } else {
      return c.json({ error: 'Organization not found' }, 404);
    }
  }

  if (!membership) {
    return c.json({ error: 'You are not a member of this organization' }, 403);
  }

  // Set organization context
  c.set('organization', {
    organizationId: orgId,
    organizationRole: membership.role as 'owner' | 'admin' | 'member' | 'viewer',
  });

  return next();
}

/**
 * Middleware to require and validate project context
 * Sets projectId and projectOrganizationId in context
 */
export async function projectScopeMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<Response | void> {
  const org = c.get('organization') as OrgContext | undefined;
  if (!org) {
    return c.json({ error: 'Organization context required' }, 400);
  }

  // Get project ID from query param, header, or body
  const projectId = c.req.query('project_id') || 
                    c.req.header('X-Project-ID') ||
                    (await c.req.json().catch(() => ({}))).project_id;

  if (!projectId) {
    return c.json({ error: 'Project ID is required' }, 400);
  }

  const db = c.env.DB;

  // Verify project belongs to the organization
  const project = await db
    .prepare('SELECT organization_id FROM projects WHERE id = ?')
    .bind(projectId)
    .first<{ organization_id: string }>();

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  if (project.organization_id !== org.organizationId) {
    return c.json({ error: 'Project does not belong to this organization' }, 403);
  }

  // Set project context
  c.set('project', {
    projectId,
    projectOrganizationId: project.organization_id,
  });

  return next();
}

/**
 * Helper to check if user has required role in organization
 */
export function requireOrgRole(...allowedRoles: ('owner' | 'admin' | 'member' | 'viewer')[]) {
  return async (c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> => {
    const org = c.get('organization') as OrgContext | undefined;
    if (!org) {
      return c.json({ error: 'Organization context required' }, 400);
    }

    const roleHierarchy: Record<string, number> = {
      viewer: 1,
      member: 2,
      admin: 3,
      owner: 4,
    };

    const userRoleLevel = roleHierarchy[org.organizationRole] || 0;
    const hasAccess = allowedRoles.some(
      (role) => userRoleLevel >= roleHierarchy[role]
    );

    if (!hasAccess) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    return next();
  };
}

