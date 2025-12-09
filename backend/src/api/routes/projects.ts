// Projects routes

import { Hono } from 'hono';
import { Env } from '../../types';
import { authMiddleware } from '../../utils/middleware';
import { organizationScopeMiddleware, requireOrgRole } from '../../utils/org-middleware';
import { generateUUID } from '../../utils/uuid';

const projects = new Hono<{ Bindings: Env }>();

// All routes require authentication
projects.use('/*', authMiddleware);

/**
 * GET /projects
 * Get projects for the current organization
 */
projects.get('/', organizationScopeMiddleware, async (c) => {
  try {
    const org = c.get('organization');
    const db = c.env.DB;

    // Check if projects table exists, if not create it
    let tableExists = false;
    try {
      const tableCheck = await db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")
        .first();
      tableExists = !!tableCheck;
    } catch (tableError: any) {
      // If error is about table not existing, that's fine
      if (!tableError.message?.includes('no such table')) {
        console.error('Error checking projects table:', tableError);
      }
    }

    if (!tableExists) {
      // Create projects table if it doesn't exist
      try {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            created_at INTEGER NOT NULL DEFAULT (unixepoch()),
            updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
          )
        `).run();

        // Create project_services table if it doesn't exist
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS project_services (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            service_id TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (unixepoch()),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (service_id) REFERENCES monitored_services(id) ON DELETE CASCADE,
            UNIQUE(project_id, service_id)
          )
        `).run();

        console.log('Created projects and project_services tables on-the-fly');
      } catch (createError: any) {
        console.error('Error creating projects tables:', createError);
        // If creation fails, return empty array
        return c.json({
          projects: [],
        });
      }
    }

    let projectsList;
    try {
      projectsList = await db
        .prepare('SELECT * FROM projects WHERE organization_id = ? ORDER BY created_at DESC')
        .bind(org.organizationId)
        .all();
    } catch (queryError: any) {
      // If query fails due to missing table/column, return empty array
      if (queryError.message?.includes('no such table') || queryError.message?.includes('no such column')) {
        console.warn('Projects table or column missing, returning empty array:', queryError.message);
        return c.json({
          projects: [],
        });
      }
      throw queryError;
    }

    // Get service count for each project
    const projectsWithCounts = await Promise.all(
      (projectsList.results || []).map(async (project: any) => {
        try {
          const serviceCount = await db
            .prepare('SELECT COUNT(*) as count FROM project_services WHERE project_id = ?')
            .bind(project.id)
            .first<{ count: number }>();
          
          return {
            ...project,
            service_count: serviceCount?.count || 0,
          };
        } catch (countError) {
          // If project_services table doesn't exist, just return project without count
          return {
            ...project,
            service_count: 0,
          };
        }
      })
    );

    return c.json({
      projects: projectsWithCounts,
    });
  } catch (error: any) {
    console.error('Error fetching projects:', error);
    // If it's a table/column error, return empty array instead of 500
    if (error.message?.includes('no such table') || error.message?.includes('no such column')) {
      return c.json({
        projects: [],
      });
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /projects
 * Create a new project
 */
projects.post('/', organizationScopeMiddleware, requireOrgRole('owner', 'admin', 'member'), async (c) => {
  try {
    const org = c.get('organization');
    const { name, description } = await c.req.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return c.json({ error: 'Project name is required' }, 400);
    }

    const db = c.env.DB;
    const projectId = generateUUID();
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        'INSERT INTO projects (id, organization_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(projectId, org.organizationId, name.trim(), description || null, now, now)
      .run();

    return c.json({
      project: {
        id: projectId,
        organization_id: org.organizationId,
        name: name.trim(),
        description: description || null,
        created_at: now,
        updated_at: now,
      },
    });
  } catch (error) {
    console.error('Error creating project:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /projects/:id
 * Get project details
 */
projects.get('/:id', organizationScopeMiddleware, async (c) => {
  try {
    const org = c.get('organization');
    const projectId = c.req.param('id');
    const db = c.env.DB;

    const project = await db
      .prepare('SELECT * FROM projects WHERE id = ? AND organization_id = ?')
      .bind(projectId, org.organizationId)
      .first();

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Get services in this project
    const services = await db
      .prepare(
        `SELECT ms.*
         FROM monitored_services ms
         JOIN project_services ps ON ms.id = ps.service_id
         WHERE ps.project_id = ?`
      )
      .bind(projectId)
      .all();

    return c.json({
      project,
      services: services.results || [],
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PATCH /projects/:id
 * Update project
 */
projects.patch('/:id', organizationScopeMiddleware, requireOrgRole('owner', 'admin', 'member'), async (c) => {
  try {
    const org = c.get('organization');
    const projectId = c.req.param('id');
    const { name, description } = await c.req.json();
    const db = c.env.DB;

    // Verify project belongs to organization
    const project = await db
      .prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?')
      .bind(projectId, org.organizationId)
      .first();

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }

    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    updates.push('updated_at = ?');
    values.push(Math.floor(Date.now() / 1000));
    values.push(projectId);

    await db
      .prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .bind(projectId)
      .first();

    return c.json({ project: updated });
  } catch (error) {
    console.error('Error updating project:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /projects/:id
 * Delete project
 */
projects.delete('/:id', organizationScopeMiddleware, requireOrgRole('owner', 'admin'), async (c) => {
  try {
    const org = c.get('organization');
    const projectId = c.req.param('id');
    const db = c.env.DB;

    // Verify project belongs to organization
    const project = await db
      .prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?')
      .bind(projectId, org.organizationId)
      .first();

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    await db.prepare('DELETE FROM projects WHERE id = ?').bind(projectId).run();

    return c.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default projects;

