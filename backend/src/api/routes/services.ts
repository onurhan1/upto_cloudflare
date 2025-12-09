// Services management routes

import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../../utils/middleware';
import { organizationScopeMiddleware, projectScopeMiddleware } from '../../utils/org-middleware';
import { generateUUID } from '../../utils/uuid';
import { handleIncidentLogic, sendNotifications } from '../../utils/incidents';
import { logAction, getIpAddress, getUserAgent } from '../../utils/audit';
import { MonitoredService } from '../types';

const services = new Hono<{ Bindings: Env }>();

// All routes require authentication
services.use('/*', authMiddleware);

/**
 * GET /services
 * List all services for the current organization/project
 * Query params: organization_id (required), project_id (optional)
 * Also includes backward compatibility: services without organization_id are assigned to user's first org
 */
services.get('/', organizationScopeMiddleware, async (c) => {
  try {
    const org = c.get('organization');
    const user = c.get('user');
    const projectId = c.req.query('project_id');
    const db = c.env.DB;
    
    console.log(`[Services] User: ${user.id} (${user.email}), Organization: ${org.organizationId}`);

    // Check if organization_id column exists, if not, skip migration logic
    // This handles cases where migration hasn't run yet
    try {
      // Try to query with organization_id to see if column exists
      const testQuery = await db
        .prepare('SELECT organization_id FROM monitored_services LIMIT 1')
        .first();
      
      // If we get here, column exists - proceed with migration logic
      // First, check ALL services for this user (regardless of organization_id)
      const allUserServices = await db
        .prepare('SELECT id, name, organization_id, is_active FROM monitored_services WHERE user_id = ?')
        .bind(user.id)
        .all<{ id: string; name: string; organization_id: string | null; is_active: number }>();
      
      console.log(`[Migration] Total services for user ${user.id}: ${allUserServices.results?.length || 0}`);
      if ((allUserServices.results || []).length > 0) {
        console.log(`[Migration] Services: ${(allUserServices.results || []).map(s => `${s.name} (org: ${s.organization_id || 'NULL'}, active: ${s.is_active})`).join(', ')}`);
      }
      
      // Check for orphaned services (both active and inactive)
      const orphanedServices = await db
        .prepare('SELECT id, name FROM monitored_services WHERE organization_id IS NULL AND user_id = ?')
        .bind(user.id)
        .all<{ id: string; name: string }>();

      console.log(`[Migration] Found ${orphanedServices.results?.length || 0} orphaned services for user ${user.id}`);
      
      if ((orphanedServices.results || []).length > 0) {
        console.log(`[Migration] Migrating ${orphanedServices.results?.length || 0} orphaned services to organization ${org.organizationId}`);
        console.log(`[Migration] Services: ${(orphanedServices.results || []).map(s => s.name).join(', ')}`);
        await db
          .prepare('UPDATE monitored_services SET organization_id = ? WHERE organization_id IS NULL AND user_id = ?')
          .bind(org.organizationId, user.id)
          .run();
        console.log(`[Migration] Migration completed successfully`);
      }
      
      // Also check for services in other organizations and migrate them if they belong to this user
      const servicesInOtherOrgs = await db
        .prepare('SELECT id, name, organization_id FROM monitored_services WHERE user_id = ? AND organization_id IS NOT NULL AND organization_id != ?')
        .bind(user.id, org.organizationId)
        .all<{ id: string; name: string; organization_id: string }>();
      
      if ((servicesInOtherOrgs.results || []).length > 0) {
        console.log(`[Migration] Found ${servicesInOtherOrgs.results?.length || 0} services in other organizations. Migrating to current organization ${org.organizationId}`);
        console.log(`[Migration] Services: ${(servicesInOtherOrgs.results || []).map(s => `${s.name} (from org: ${s.organization_id})`).join(', ')}`);
        await db
          .prepare('UPDATE monitored_services SET organization_id = ? WHERE user_id = ? AND organization_id != ?')
          .bind(org.organizationId, user.id, org.organizationId)
          .run();
        console.log(`[Migration] All user services migrated to current organization`);
      }
    } catch (colError: any) {
      // Column doesn't exist - fallback to user_id only query
      console.warn('organization_id column not found, using user_id only query:', colError.message);
    }

    // Check if organization_id column exists
    let query: string;
    let bindParams: any[];
    
    try {
      // Try to query with organization_id
      const testCol = await db
        .prepare('SELECT organization_id FROM monitored_services LIMIT 1')
        .first();
      
      // Column exists - use organization_id in query
      // Also include services that were just migrated (might have is_active = 0)
      query = 'SELECT * FROM monitored_services WHERE organization_id = ? AND is_active = 1';
      bindParams = [org.organizationId];
      
      // After migration, also check if there are any services that were just migrated
      // This ensures we catch all services even if they were inactive before migration
      
      // Debug: Log the query we're about to execute
      console.log(`[Services Query] Executing: ${query} with params: [${bindParams.join(', ')}]`);

      if (projectId) {
        query += ' AND project_id = ?';
        bindParams.push(projectId);
      }
    } catch (colError: any) {
      // Column doesn't exist - fallback to user_id only (backward compatibility)
      console.warn('organization_id column not found, falling back to user_id query');
      query = 'SELECT * FROM monitored_services WHERE user_id = ? AND is_active = 1';
      bindParams = [user.id];

      if (projectId) {
        // Check if project_id column exists
        try {
          const testProjectCol = await db
            .prepare('SELECT project_id FROM monitored_services LIMIT 1')
            .first();
          query += ' AND project_id = ?';
          bindParams.push(projectId);
        } catch {
          // project_id column doesn't exist, skip it
        }
      }
    }

    query += ' ORDER BY created_at DESC';

    const result = await db
      .prepare(query)
      .bind(...bindParams)
      .all<MonitoredService>();

    // Batch read: Get latest check status for all services in one query
    const serviceIds = (result.results || []).map((s) => s.id);
    let statusMap: Record<string, string> = {};

    if (serviceIds.length > 0) {
      // Use a single query with window function or subquery to get latest status for each service
      // SQLite doesn't support window functions in older versions, so we'll use a subquery
      const placeholders = serviceIds.map(() => '?').join(',');
      const latestChecks = await db
        .prepare(
          `SELECT DISTINCT 
            service_id,
            (SELECT status FROM service_checks sc2 
             WHERE sc2.service_id = sc1.service_id 
             ORDER BY sc2.checked_at DESC LIMIT 1) as status
           FROM service_checks sc1
           WHERE sc1.service_id IN (${placeholders})`
        )
        .bind(...serviceIds)
        .all<{ service_id: string; status: string }>();

      // Build status map
      for (const check of latestChecks.results || []) {
        if (check.status) {
          statusMap[check.service_id] = check.status;
        }
      }
    }

    // Map services with their statuses
    const servicesWithStatus = (result.results || []).map((service) => ({
      ...service,
      currentStatus: statusMap[service.id] || 'unknown',
    }));

    return c.json({ services: servicesWithStatus });
  } catch (error) {
    console.error('Error fetching services:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /services/:id
 * Get service details
 */
services.get('/:id', organizationScopeMiddleware, async (c) => {
  try {
    const org = c.get('organization');
    const user = c.get('user');
    const serviceId = c.req.param('id');
    const db = c.env.DB;

    // First try to find service in current organization
    let service = await db
      .prepare(
        'SELECT * FROM monitored_services WHERE id = ? AND organization_id = ?'
      )
      .bind(serviceId, org.organizationId)
      .first<MonitoredService>();

    // If not found, check if it's an orphaned service (backward compatibility)
    if (!service) {
      const orphanedService = await db
        .prepare('SELECT * FROM monitored_services WHERE id = ? AND organization_id IS NULL AND user_id = ?')
        .bind(serviceId, user.id)
        .first<MonitoredService>();

      if (orphanedService) {
        // Migrate it to current organization
        await db
          .prepare('UPDATE monitored_services SET organization_id = ? WHERE id = ?')
          .bind(org.organizationId, serviceId)
          .run();
        service = { ...orphanedService, organization_id: org.organizationId };
      }
    }

    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }

    // Get recent checks
    const checks = await db
      .prepare(
        'SELECT * FROM service_checks WHERE service_id = ? ORDER BY checked_at DESC LIMIT 50'
      )
      .bind(serviceId)
      .all();

    // Get open incidents
    const incidents = await db
      .prepare(
        'SELECT * FROM incidents WHERE service_id = ? AND status != ? ORDER BY started_at DESC'
      )
      .bind(serviceId, 'resolved')
      .all();

    return c.json({
      service,
      recentChecks: checks.results || [],
      openIncidents: incidents.results || [],
    });
  } catch (error) {
    console.error('Error fetching service:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /services/:id/suggestions
 * Get AI-powered suggestions for service monitoring parameters
 */
services.get('/:id/suggestions', organizationScopeMiddleware, async (c) => {
  try {
    const org = c.get('organization');
    const user = c.get('user');
    const serviceId = c.req.param('id');
    const db = c.env.DB;

    // Verify service belongs to organization
    const service = await db
      .prepare('SELECT * FROM monitored_services WHERE id = ? AND organization_id = ?')
      .bind(serviceId, org.organizationId)
      .first<MonitoredService>();

    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }

    // Get historical checks (last 100)
    const historicalChecks = await db
      .prepare(
        'SELECT * FROM service_checks WHERE service_id = ? ORDER BY checked_at DESC LIMIT 100'
      )
      .bind(serviceId)
      .all<{
        status: string;
        response_time_ms: number | null;
        status_code: number | null;
        checked_at: number;
      }>();

    // Generate AI suggestions
    const { generateServiceSuggestions } = await import('../../utils/ai');
    const suggestions = await generateServiceSuggestions(
      service.name,
      service.type,
      service.url_or_host,
      service.check_interval_seconds,
      service.timeout_ms,
      (historicalChecks.results || []).reverse(), // Reverse to get chronological order
      c.env,
      user.id // Pass user_id to fetch API key from database
    );

    if (!suggestions) {
      return c.json({ error: 'Unable to generate suggestions. OpenAI API key may not be configured.' }, 503);
    }

    return c.json({ suggestions });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /services
 * Create a new service (requires organization context, optional project_id)
 */
services.post('/', organizationScopeMiddleware, async (c) => {
  try {
    const org = c.get('organization');
    const user = c.get('user');
    const body = await c.req.json();
    const db = c.env.DB;

    const {
      name,
      type,
      url_or_host,
      port,
      project_id,
      check_interval_seconds = 60,
      timeout_ms = 5000,
      expected_status_code,
      expected_keyword,
      notify_telegram = false,
      notify_email = false,
    } = body;

    if (!name || !type || !url_or_host) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // If project_id is provided, verify it belongs to the organization
    if (project_id) {
      const project = await db
        .prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?')
        .bind(project_id, org.organizationId)
        .first();

      if (!project) {
        return c.json({ error: 'Project not found or does not belong to this organization' }, 404);
      }
    }

    const serviceId = generateUUID();
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO monitored_services 
        (id, user_id, organization_id, project_id, name, type, url_or_host, port, check_interval_seconds, 
         timeout_ms, expected_status_code, expected_keyword, is_active, 
         notify_telegram, notify_email, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        serviceId,
        user.id,
        org.organizationId,
        project_id || null,
        name,
        type,
        url_or_host,
        port || null,
        check_interval_seconds,
        timeout_ms,
        expected_status_code || null,
        expected_keyword || null,
        1,
        notify_telegram ? 1 : 0,
        notify_email ? 1 : 0,
        now,
        now
      )
      .run();

    // If project_id is provided, link service to project
    if (project_id) {
      const projectServiceId = generateUUID();
      await db
        .prepare('INSERT INTO project_services (id, project_id, service_id, created_at) VALUES (?, ?, ?, ?)')
        .bind(projectServiceId, project_id, serviceId, now)
        .run();
    }

    const service = await db
      .prepare('SELECT * FROM monitored_services WHERE id = ?')
      .bind(serviceId)
      .first<MonitoredService>();

    // Perform initial health check immediately after service creation
    // This runs asynchronously so it doesn't block the response
    (async () => {
      try {
        console.log(`Performing initial health check for new service ${serviceId} (${service.type}): ${service.url_or_host}`);
        
        // Import health check utilities
        const { checkDns, checkSsl, checkPing } = await import('../../utils/health-checks');
        
        const startTime = Date.now();
        let status: 'up' | 'down' | 'degraded' = 'down';
        let responseTime: number | null = null;
        let statusCode: number | null = null;
        let errorMessage: string | null = null;

        try {
          // Perform health check based on type
          switch (service.type) {
            case 'http':
            case 'api': {
              let fullUrl = service.url_or_host.startsWith('http') ? service.url_or_host : `https://${service.url_or_host}`;
              // Remove trailing slash if present (can cause issues with some servers)
              if (fullUrl.endsWith('/')) {
                fullUrl = fullUrl.slice(0, -1);
              }
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), service.timeout_ms);

              console.log(`[HTTP Check] Checking: ${fullUrl}`);

              const response = await fetch(fullUrl, {
                method: 'GET',
                signal: controller.signal,
                redirect: 'follow',
                headers: {
                  'User-Agent': 'Upto-Monitor/1.0',
                },
              });

              clearTimeout(timeout);
              responseTime = Date.now() - startTime;
              statusCode = response.status;
              
              console.log(`[HTTP Check] ${fullUrl} - Status: ${statusCode}, OK: ${response.ok}`);

              // Check status code (only if explicitly expected)
              if (service.expected_status_code && statusCode !== service.expected_status_code) {
                if (statusCode >= 300 && statusCode < 400) {
                  status = 'up';
                } else {
                  status = 'down';
                  errorMessage = `Expected status ${service.expected_status_code}, got ${statusCode}`;
                }
              } else if (service.expected_keyword) {
                // Check keyword (only if explicitly expected) - read body only if needed
                try {
                  const text = await response.text();
                  if (!text.includes(service.expected_keyword)) {
                    status = 'down';
                    errorMessage = `Expected keyword not found: ${service.expected_keyword}`;
                  } else {
                    // Keyword found, continue with status code check
                    if (statusCode >= 500) {
                      status = 'down';
                    } else if (statusCode >= 400) {
                      status = 'degraded';
                    } else if (statusCode >= 300 && statusCode < 400) {
                      status = 'up';
                    } else {
                      status = 'up';
                    }

                    if (responseTime > 3000) {
                      status = 'degraded';
                    }
                  }
                } catch (textError: any) {
                  // If reading text fails, we can't check keyword, but status code check already passed
                  console.warn(`[HTTP Check] Failed to read response body for keyword check: ${textError.message}`);
                  // Continue with status code check
                  if (statusCode >= 500) {
                    status = 'down';
                  } else if (statusCode >= 400) {
                    status = 'degraded';
                  } else if (statusCode >= 300 && statusCode < 400) {
                    status = 'up';
                  } else {
                    status = 'up';
                  }

                  if (responseTime > 3000) {
                    status = 'degraded';
                  }
                }
              } else {
                if (statusCode >= 500) {
                  status = 'down';
                } else if (statusCode >= 400) {
                  status = 'degraded';
                } else if (statusCode >= 300 && statusCode < 400) {
                  status = 'up';
                } else {
                  status = 'up';
                }

                if (responseTime > 3000) {
                  status = 'degraded';
                }
              }
              break;
            }

            case 'ping': {
              const pingResult = await checkPing(service.url_or_host, service.timeout_ms);
              status = pingResult.status;
              responseTime = pingResult.responseTime;
              statusCode = null;
              errorMessage = pingResult.errorMessage;
              break;
            }

            case 'dns': {
              const dnsResult = await checkDns(service.url_or_host, service.timeout_ms);
              status = dnsResult.status;
              responseTime = dnsResult.responseTime;
              statusCode = null;
              errorMessage = dnsResult.errorMessage;
              break;
            }

            case 'ssl': {
              // Remove trailing slash if present (can cause issues with SSL checks)
              const cleanUrl = service.url_or_host.endsWith('/') 
                ? service.url_or_host.slice(0, -1) 
                : service.url_or_host;
              const sslResult = await checkSsl(cleanUrl, service.timeout_ms);
              status = sslResult.status;
              responseTime = sslResult.responseTime;
              statusCode = null;
              errorMessage = sslResult.errorMessage;
              break;
            }

            case 'domain': {
              const domainDnsResult = await checkDns(service.url_or_host, service.timeout_ms);
              if (domainDnsResult.status === 'up') {
                const fullUrl = service.url_or_host.startsWith('http') ? service.url_or_host : `https://${service.url_or_host}`;
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), service.timeout_ms);

                try {
                  const response = await fetch(fullUrl, {
                    method: 'GET',
                    signal: controller.signal,
                    redirect: 'follow',
                    headers: {
                      'User-Agent': 'Upto-Monitor/1.0',
                    },
                  });
                  clearTimeout(timeout);
                  const httpResponseTime = Date.now() - startTime;
                  statusCode = response.status;
                  if (response.ok || (statusCode >= 300 && statusCode < 400)) {
                    status = 'up';
                  } else if (statusCode >= 500) {
                    status = 'down';
                  } else {
                    status = 'degraded';
                  }
                  responseTime = domainDnsResult.responseTime + httpResponseTime;
                } catch (httpError: any) {
                  clearTimeout(timeout);
                  status = 'down';
                  responseTime = domainDnsResult.responseTime;
                  errorMessage = httpError.message || 'HTTP check failed';
                }
              } else {
                status = domainDnsResult.status;
                responseTime = domainDnsResult.responseTime;
                errorMessage = domainDnsResult.errorMessage;
              }
              break;
            }

            default:
              status = 'down';
              errorMessage = `Unsupported check type: ${service.type}`;
          }
        } catch (error: any) {
          responseTime = Date.now() - startTime;
          status = 'down';
          statusCode = null;
          errorMessage = error.message || 'Request failed';
        }

        // Save check result to database
        const checkId = generateUUID();
        const checkedAt = Math.floor(Date.now() / 1000);

        await db
          .prepare(
            `INSERT INTO service_checks 
            (id, service_id, status, response_time_ms, status_code, error_message, checked_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            checkId,
            service.id,
            status,
            responseTime,
            statusCode,
            errorMessage,
            checkedAt
          )
          .run();

        // Update KV snapshot with optimized write frequency
        const { writeServiceSnapshot } = await import('../../utils/kv-cache');
        await writeServiceSnapshot(c.env, service.id, {
          status,
          responseTime,
          statusCode,
          lastCheck: checkedAt,
          errorMessage,
        });

        // Update Durable Object state if available
        if (c.env.SERVICE_STATE) {
          try {
            const doId = c.env.SERVICE_STATE.idFromName(service.id);
            const stub = c.env.SERVICE_STATE.get(doId);
            await stub.fetch(new Request('https://internal/update', {
              method: 'POST',
              body: JSON.stringify({
                status,
                timestamp: checkedAt,
              }),
            }));
          } catch (doError) {
            console.error('Durable Object update error:', doError);
          }
        }

        // Handle incident logic (create/resolve incidents)
        await handleIncidentLogic(service.id, status, c.env);

        console.log(`Initial health check completed for service ${serviceId}: ${status}`);
      } catch (error) {
        console.error(`Error performing initial health check for service ${serviceId}:`, error);
      }
    })();

    // Send notification for new service if notifications are enabled
    if (service && (service.notify_telegram || service.notify_email)) {
      try {
        await sendNotifications(
          { 
            id: service.id, 
            user_id: service.user_id, 
            name: service.name, 
            url_or_host: service.url_or_host 
          },
          service.id, // Use service ID as incident ID for new service notification
          'new',
          c.env
        );
      } catch (error) {
        console.error('Error sending new service notification:', error);
        // Don't fail the request if notification fails
      }
    }

    // Log service creation
    await logAction(
      'service.create',
      {
        resource_type: 'service',
        resource_id: serviceId,
        name: service.name,
        type: service.type,
        url_or_host: service.url_or_host,
      },
      {
        userId: user.id,
        organizationId: org.organizationId,
        ipAddress: getIpAddress(c.req.raw),
        userAgent: getUserAgent(c.req.raw),
      },
      c.env
    );

    return c.json({ service }, 201);
  } catch (error) {
    console.error('Error creating service:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PATCH /services/:id
 * Update a service
 */
services.patch('/:id', async (c) => {
  try {
    const user = c.get('user');
    const serviceId = c.req.param('id');
    const body = await c.req.json();
    const db = c.env.DB;

    // Verify ownership
    const existing = await db
      .prepare('SELECT id FROM monitored_services WHERE id = ? AND user_id = ?')
      .bind(serviceId, user.id)
      .first();

    if (!existing) {
      return c.json({ error: 'Service not found' }, 404);
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    const allowedFields = [
      'name',
      'url_or_host',
      'port',
      'check_interval_seconds',
      'timeout_ms',
      'expected_status_code',
      'expected_keyword',
      'is_active',
      'notify_telegram',
      'notify_email',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    updates.push('updated_at = ?');
    values.push(Math.floor(Date.now() / 1000));
    values.push(serviceId);

    await db
      .prepare(
        `UPDATE monitored_services SET ${updates.join(', ')} WHERE id = ?`
      )
      .bind(...values)
      .run();

    const service = await db
      .prepare('SELECT * FROM monitored_services WHERE id = ?')
      .bind(serviceId)
      .first<MonitoredService>();

    // Log service update
    await logAction(
      'service.update',
      {
        resource_type: 'service',
        resource_id: serviceId,
        name: service.name,
        updated_fields: Object.keys(body),
      },
      {
        userId: user.id,
        organizationId: org.organizationId,
        ipAddress: getIpAddress(c.req.raw),
        userAgent: getUserAgent(c.req.raw),
      },
      c.env
    );

    return c.json({ service });
  } catch (error) {
    console.error('Error updating service:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /services/:id
 * Delete a service
 */
services.delete('/:id', organizationScopeMiddleware, async (c) => {
  try {
    const org = c.get('organization');
    const user = c.get('user');
    const serviceId = c.req.param('id');
    const db = c.env.DB;

    // Verify service belongs to organization
    const existing = await db
      .prepare('SELECT id FROM monitored_services WHERE id = ? AND organization_id = ?')
      .bind(serviceId, org.organizationId)
      .first();

    if (!existing) {
      return c.json({ error: 'Service not found' }, 404);
    }

    // Get full service info before deletion for audit log and notification
    const service = await db
      .prepare('SELECT id, user_id, name, type, url_or_host FROM monitored_services WHERE id = ?')
      .bind(serviceId)
      .first<{ id: string; user_id: string; name: string; type: string; url_or_host: string }>();

    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }

    // Send Telegram notification before deletion
    try {
      const integration = await db
        .prepare('SELECT telegram_chat_id FROM integrations WHERE user_id = ? AND is_active = 1')
        .bind(service.user_id)
        .first<{ telegram_chat_id: string | null }>();

      if (integration?.telegram_chat_id && c.env.TELEGRAM_BOT_TOKEN) {
        const serviceUrl = service.url_or_host || 'N/A';
        const message = `🗑️ Service Deleted: ${service.name}\n\n📍 URL: ${serviceUrl}\n📊 Type: ${service.type}\n\nMonitoring has been stopped for this service.`;

        const response = await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: integration.telegram_chat_id,
            text: message,
          }),
        });

        const result = await response.json();
        if (result.ok) {
          console.log('Telegram notification sent for service deletion');
        } else {
          console.error('Telegram API error:', result);
        }
      }
    } catch (notifError) {
      console.error('Error sending deletion notification:', notifError);
      // Don't fail the deletion if notification fails
    }

    // Log service deletion before deleting
    await logAction(
      'service.delete',
      {
        resource_type: 'service',
        resource_id: serviceId,
        name: service.name,
        type: service.type,
      },
      {
        userId: user.id,
        organizationId: org.organizationId,
        ipAddress: getIpAddress(c.req.raw),
        userAgent: getUserAgent(c.req.raw),
      },
      c.env
    );

    // Hard delete - remove the service completely
    await db
      .prepare('DELETE FROM monitored_services WHERE id = ?')
      .bind(serviceId)
      .run();

    // Also delete related service checks
    await db
      .prepare('DELETE FROM service_checks WHERE service_id = ?')
      .bind(serviceId)
      .run();

    // Delete from status page services
    await db
      .prepare('DELETE FROM status_page_services WHERE service_id = ?')
      .bind(serviceId)
      .run();

    // Delete from project_services if exists
    await db
      .prepare('DELETE FROM project_services WHERE service_id = ?')
      .bind(serviceId)
      .run();

    return c.json({ message: 'Service deleted' });
  } catch (error) {
    console.error('Error deleting service:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /services/:id/test
 * Manually trigger a health check
 */
services.post('/:id/test', organizationScopeMiddleware, async (c) => {
  try {
    const org = c.get('organization');
    const serviceId = c.req.param('id');
    const db = c.env.DB;
    const queue = c.env.MONITORING_QUEUE;

    // Verify service belongs to organization
    const service = await db
      .prepare('SELECT * FROM monitored_services WHERE id = ? AND organization_id = ?')
      .bind(serviceId, org.organizationId)
      .first<MonitoredService>();

    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }

    const job = {
      service_id: service.id,
      type: service.type,
      url_or_host: service.url_or_host,
      port: service.port,
      timeout_ms: service.timeout_ms,
      expected_status_code: service.expected_status_code,
      expected_keyword: service.expected_keyword,
    };

    // If queue is available, use it
    if (queue) {
      try {
        await queue.send(job);
        return c.json({ message: 'Health check queued' });
      } catch (queueError: any) {
        console.error('Queue error:', queueError);
        // Fall through to direct processing
      }
    }

    // Direct processing for local development when queue is unavailable
    // Import health check utilities
    const { checkDns, checkSsl, checkPing } = await import('../../utils/health-checks');
    
    // Process health check inline
    const {
      type,
      url_or_host,
      port,
      timeout_ms,
      expected_status_code,
      expected_keyword,
    } = job;

    console.log(`Manually checking service ${service.id} (${type}): ${url_or_host}`);

    const startTime = Date.now();
    let status: 'up' | 'down' | 'degraded' = 'down';
    let responseTime: number | null = null;
    let statusCode: number | null = null;
    let errorMessage: string | null = null;

    try {
      // Perform health check based on type
      switch (type) {
        case 'http':
        case 'api': {
          let fullUrl = url_or_host.startsWith('http') ? url_or_host : `https://${url_or_host}`;
          // Remove trailing slash if present (can cause issues with some servers)
          if (fullUrl.endsWith('/')) {
            fullUrl = fullUrl.slice(0, -1);
          }
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeout_ms);

          console.log(`[HTTP Check] Checking: ${fullUrl}`);

          const response = await fetch(fullUrl, {
            method: 'GET',
            signal: controller.signal,
            redirect: 'follow', // Follow redirects (HTTP -> HTTPS is normal)
            headers: {
              'User-Agent': 'Upto-Monitor/1.0',
            },
          });

          clearTimeout(timeout);
          responseTime = Date.now() - startTime;
          statusCode = response.status;

          // Check status code (only if explicitly expected)
          if (expected_status_code && statusCode !== expected_status_code) {
            // If we got a redirect (3xx) but expected a different code, that's still OK
            // Redirects are normal behavior (HTTP -> HTTPS)
            if (statusCode >= 300 && statusCode < 400) {
              // Redirect is OK, continue with normal processing
              status = 'up';
            } else {
              status = 'down';
              errorMessage = `Expected status ${expected_status_code}, got ${statusCode}`;
            }
          } else if (expected_keyword) {
            // Check keyword (only if explicitly expected) - read body only if needed
            try {
              const text = await response.text();
              if (!text.includes(expected_keyword)) {
                status = 'down';
                errorMessage = `Expected keyword not found: ${expected_keyword}`;
              } else {
                // Keyword found, continue with status code check
                if (statusCode >= 500) {
                  status = 'down';
                } else if (statusCode >= 400) {
                  status = 'degraded';
                } else if (statusCode >= 300 && statusCode < 400) {
                  status = 'up';
                } else {
                  status = 'up';
                }

                if (responseTime > 3000) {
                  status = 'degraded';
                }
              }
            } catch (textError: any) {
              // If reading text fails, we can't check keyword, but status code check already passed
              console.warn(`[HTTP Check] Failed to read response body for keyword check: ${textError.message}`);
              // Continue with status code check
              if (statusCode >= 500) {
                status = 'down';
              } else if (statusCode >= 400) {
                status = 'degraded';
              } else if (statusCode >= 300 && statusCode < 400) {
                status = 'up';
              } else {
                status = 'up';
              }

              if (responseTime > 3000) {
                status = 'degraded';
              }
            }
          } else {
            // Determine status based on HTTP status code
            // 2xx and 3xx (redirects) are considered UP
            // 4xx are degraded (client errors but server is responding)
            // 5xx are down (server errors)
            if (statusCode >= 500) {
              status = 'down';
            } else if (statusCode >= 400) {
              status = 'degraded';
            } else if (statusCode >= 300 && statusCode < 400) {
              // 3xx redirects are normal and indicate the service is working
              status = 'up';
            } else {
              // 2xx success
              status = 'up';
            }

            // Consider response time for degraded status
            if (responseTime > 3000) {
              status = 'degraded';
            }
          }
          break;
        }

        case 'ping': {
          const pingResult = await checkPing(url_or_host, timeout_ms);
          status = pingResult.status;
          responseTime = pingResult.responseTime;
          statusCode = null;
          errorMessage = pingResult.errorMessage;
          break;
        }

        case 'dns': {
          const dnsResult = await checkDns(url_or_host, timeout_ms);
          status = dnsResult.status;
          responseTime = dnsResult.responseTime;
          statusCode = null;
          errorMessage = dnsResult.errorMessage;
          break;
        }

        case 'ssl': {
          // Remove trailing slash if present (can cause issues with SSL checks)
          const cleanSslUrl = url_or_host.endsWith('/') 
            ? url_or_host.slice(0, -1) 
            : url_or_host;
          const sslResult = await checkSsl(cleanSslUrl, timeout_ms);
          status = sslResult.status;
          responseTime = sslResult.responseTime;
          statusCode = null;
          errorMessage = sslResult.errorMessage;
          // SSL check returns 'up' for successful HTTPS connections (including redirects)
          break;
        }

        case 'domain': {
          // Domain check: try DNS first, then HTTP
          const domainDnsResult = await checkDns(url_or_host, timeout_ms);
          if (domainDnsResult.status === 'up') {
            // DNS works, try HTTP
            const fullUrl = url_or_host.startsWith('http') ? url_or_host : `https://${url_or_host}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeout_ms);

            try {
              const response = await fetch(fullUrl, {
                method: 'GET',
                signal: controller.signal,
                redirect: 'follow', // Follow redirects
                headers: {
                  'User-Agent': 'Upto-Monitor/1.0',
                },
              });
              clearTimeout(timeout);
              const httpResponseTime = Date.now() - startTime;
              statusCode = response.status;
              // 2xx and 3xx (redirects) are UP, 4xx degraded, 5xx down
              if (response.ok || (statusCode >= 300 && statusCode < 400)) {
                status = 'up';
              } else if (statusCode >= 500) {
                status = 'down';
              } else {
                status = 'degraded';
              }
              responseTime = domainDnsResult.responseTime + httpResponseTime;
            } catch (httpError: any) {
              clearTimeout(timeout);
              status = 'down';
              responseTime = domainDnsResult.responseTime;
              errorMessage = httpError.message || 'HTTP check failed';
            }
          } else {
            status = domainDnsResult.status;
            responseTime = domainDnsResult.responseTime;
            errorMessage = domainDnsResult.errorMessage;
          }
          break;
        }

        default:
          status = 'down';
          errorMessage = `Unsupported check type: ${type}`;
      }
    } catch (error: any) {
      responseTime = Date.now() - startTime;
      status = 'down';
      statusCode = null;
      errorMessage = error.message || 'Request failed';
    }

    // Save check result to database
    const checkId = crypto.randomUUID();
    const checkedAt = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO service_checks 
        (id, service_id, status, response_time_ms, status_code, error_message, checked_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        checkId,
        service.id,
        status,
        responseTime,
        statusCode,
        errorMessage,
        checkedAt
      )
      .run();

    // Update KV snapshot if available
    if (c.env.STATUS_SNAPSHOTS) {
      const snapshot = {
        status,
        responseTime,
        statusCode,
        lastCheck: checkedAt,
        errorMessage,
      };
      await c.env.STATUS_SNAPSHOTS.put(
        `service:${service.id}`,
        JSON.stringify(snapshot),
        { expirationTtl: 86400 } // 24 hours
      );
    }

    // Update Durable Object state with optimized batch mode
    const { updateServiceState } = await import('../../utils/durable-objects');
    await updateServiceState(c.env, service.id, status, checkedAt, status === 'down' || status === 'degraded');

    // Handle incident logic (create/resolve incidents)
    await handleIncidentLogic(service.id, status, c.env);

    // For manual tests, always send notification if service is down and notifications are enabled
    if (status === 'down' && (service.notify_telegram || service.notify_email)) {
      // Check if there's an open incident
      const openIncident = await db
        .prepare(
          "SELECT id FROM incidents WHERE service_id = ? AND status != 'resolved' ORDER BY started_at DESC LIMIT 1"
        )
        .bind(service.id)
        .first<{ id: string }>();

      if (openIncident) {
        // Send notification with existing incident ID
        await sendNotifications(
          { 
            id: service.id, 
            user_id: service.user_id, 
            name: service.name, 
            url_or_host: service.url_or_host 
          },
          openIncident.id,
          'down',
          c.env
        );
      }
    }

    return c.json({ 
      message: 'Health check completed',
      status,
      responseTime,
      statusCode,
      checkedAt
    });
  } catch (error: any) {
    console.error('Error in test endpoint:', error);
    return c.json({ 
      error: 'Internal server error',
      details: error.message 
    }, 500);
  }
});

export default services;

