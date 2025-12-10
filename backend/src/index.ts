// Main entry point for Cloudflare Worker
// Handles both API requests and scheduled cron jobs

import apiApp from './api';
import { Env } from './types';
import { ServiceStateObject } from './durable-objects/ServiceStateObject';
import { runMigrations } from './utils/migrations';
import { logger } from './utils/logger';

// Export Durable Object for wrangler.toml
export { ServiceStateObject };

// Global flag to track if migrations have been run
let migrationsRun = false;

// Initialize logger with environment log level
if (typeof process !== 'undefined' && process.env) {
  const logLevel = process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | undefined;
  if (logLevel) {
    logger.setLogLevel(logLevel);
  }
}

/**
 * Main fetch handler for API requests
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Run migrations on first request (only once per worker instance)
    if (!migrationsRun) {
      migrationsRun = true;
      // Run migrations synchronously on first request to ensure they complete
      // This ensures the database is ready before handling requests
      try {
        await runMigrations(env);
      } catch (err) {
        console.error('Migration error:', err);
        // Continue even if migrations fail (for local dev where they might already be applied)
      }
    }

    return apiApp.fetch(request, env, ctx);
  },

  /**
   * Cron trigger handler - runs every minute
   * Schedules health checks for services that need to be checked
   * Also calculates uptime percentages every 5 minutes
   */
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // Run migrations on first scheduled event
    if (!migrationsRun) {
      migrationsRun = true;
      await runMigrations(env);
    }

    console.log('Cron triggered at:', new Date().toISOString());

    try {
      const db = env.DB;
      const queue = env.MONITORING_QUEUE;

      // Check if this is an uptime calculation run (every 5 minutes)
      const now = new Date();
      const shouldCalculateUptime = now.getMinutes() % 5 === 0;

      if (shouldCalculateUptime) {
        await calculateUptimePercentages(db, env);
      }

      // Get all active services
      const services = await db
        .prepare(
          'SELECT * FROM monitored_services WHERE is_active = 1 ORDER BY id'
        )
        .all<{
          id: string;
          check_interval_seconds: number;
          type: string;
          url_or_host: string;
          port: number | null;
          timeout_ms: number;
          expected_status_code: number | null;
          expected_keyword: string | null;
        }>();

      const timestamp = Math.floor(Date.now() / 1000);

      // For each service, check if it needs to be checked now
      // For local development: if queue is not available, process directly
      // In production: queue all active services for processing
      for (const service of services.results || []) {
        // Check if service should be checked (every minute for all active services)
        // For now, we'll check all active services every minute
        const job = {
          service_id: service.id,
          type: service.type,
          url_or_host: service.url_or_host,
          port: service.port,
          timeout_ms: service.timeout_ms,
          expected_status_code: service.expected_status_code,
          expected_keyword: service.expected_keyword,
        };

        if (queue) {
          // Production: use queue
          try {
            await queue.send(job);
          } catch (error) {
            console.error(`Error queuing service ${service.id}:`, error);
            // Fallback: process directly if queue fails
            try {
              await processHealthCheck(job, env);
            } catch (processError) {
              console.error(`Error processing service ${service.id} directly:`, processError);
            }
          }
        } else {
          // Local development: process directly
          try {
            await processHealthCheck(job, env);
          } catch (error) {
            console.error(`Error processing service ${service.id}:`, error);
          }
        }
      }

      console.log(`Queued ${services.results?.length || 0} services for checking`);
    } catch (error) {
      console.error('Error in scheduled handler:', error);
    }
  },

  /**
   * Queue consumer - processes health check jobs
   */
  async queue(
    batch: MessageBatch<any>,
    env: Env
  ): Promise<void> {
    console.log(`Processing queue batch with ${batch.messages.length} messages`);

    for (const message of batch.messages) {
      try {
        const job = message.body;
        await processHealthCheck(job, env);
        message.ack();
      } catch (error) {
        console.error('Error processing message:', error);
        message.retry();
      }
    }
  },
};

/**
 * Process a single health check job
 */
async function processHealthCheck(job: any, env: Env): Promise<void> {
  const {
    service_id,
    type,
    url_or_host,
    port,
    timeout_ms,
    expected_status_code,
    expected_keyword,
  } = job;

  console.log(`Checking service ${service_id} (${type}): ${url_or_host}`);

  const startTime = Date.now();
  let status: 'up' | 'down' | 'degraded' = 'down';
  let responseTime: number | null = null;
  let statusCode: number | null = null;
  let errorMessage: string | null = null;

  try {
    // Import health check utilities
    const { checkDns, checkSsl, checkPing } = await import('./utils/health-checks');

    // Perform health check based on type
    switch (type) {
      case 'http':
      case 'api':
        const result = await checkHttp(
          url_or_host,
          timeout_ms,
          expected_status_code,
          expected_keyword
        );
        status = result.status;
        responseTime = result.responseTime;
        statusCode = result.statusCode;
        errorMessage = result.errorMessage;
        break;

      case 'ping':
        const pingResult = await checkPing(url_or_host, timeout_ms);
        status = pingResult.status;
        responseTime = pingResult.responseTime;
        statusCode = null;
        errorMessage = pingResult.errorMessage;
        break;

      case 'dns':
        const dnsResult = await checkDns(url_or_host, timeout_ms);
        status = dnsResult.status;
        responseTime = dnsResult.responseTime;
        statusCode = null;
        errorMessage = dnsResult.errorMessage;
        break;

      case 'ssl':
        // Remove trailing slash if present (can cause issues with SSL checks)
        const cleanSslUrl = url_or_host.endsWith('/')
          ? url_or_host.slice(0, -1)
          : url_or_host;
        const sslResult = await checkSsl(cleanSslUrl, timeout_ms);
        status = sslResult.status;
        responseTime = sslResult.responseTime;
        statusCode = null;
        errorMessage = sslResult.errorMessage;
        break;

      case 'domain':
        // Domain check: try DNS first, then HTTP
        const domainDnsResult = await checkDns(url_or_host, timeout_ms);
        if (domainDnsResult.status === 'up') {
          // DNS works, try HTTP
          const domainHttpResult = await checkHttp(url_or_host, timeout_ms);
          status = domainHttpResult.status;
          responseTime = domainDnsResult.responseTime + domainHttpResult.responseTime;
          statusCode = domainHttpResult.statusCode;
          errorMessage = domainHttpResult.errorMessage || domainDnsResult.errorMessage;
        } else {
          status = domainDnsResult.status;
          responseTime = domainDnsResult.responseTime;
          statusCode = null;
          errorMessage = domainDnsResult.errorMessage;
        }
        break;

      default:
        errorMessage = `Unsupported check type: ${type}`;
        status = 'down';
    }
  } catch (error: any) {
    console.error(`Health check failed for ${service_id}:`, error);
    status = 'down';
    errorMessage = error.message || 'Unknown error';
    responseTime = Date.now() - startTime;
  }

  // Save check result to database
  const db = env.DB;
  const checkId = crypto.randomUUID();
  const checkedAt = Math.floor(Date.now() / 1000);

  // Anomaly detection (only if we have response time)
  let anomalyDetected = false;
  let anomalyType: 'spike' | 'slowdown' | 'unknown' | null = null;
  let anomalyScore: number | null = null;

  if (responseTime !== null && status === 'up') {
    // Get historical response times for this service (last 50 checks)
    const historicalChecks = await db
      .prepare(
        `SELECT response_time_ms FROM service_checks 
         WHERE service_id = ? AND response_time_ms IS NOT NULL AND status = 'up'
         ORDER BY checked_at DESC LIMIT 50`
      )
      .bind(service_id)
      .all<{ response_time_ms: number }>();

    if (historicalChecks.results && historicalChecks.results.length >= 2) {
      // Extract response times (reverse to get chronological order)
      const historicalValues = historicalChecks.results
        .map((r) => r.response_time_ms)
        .reverse();

      // Detect anomaly
      const { detectAnomaly } = await import('./utils/anomalyDetection');
      const anomalyResult = detectAnomaly(responseTime, historicalValues, 20, 3);

      anomalyDetected = anomalyResult.anomalyDetected;
      anomalyType = anomalyResult.anomalyType;
      anomalyScore = anomalyResult.anomalyScore;

      if (anomalyDetected) {
        console.log(
          `[Anomaly] Service ${service_id}: ${anomalyType} detected (score: ${anomalyScore.toFixed(2)}, z-score: ${anomalyResult.zScore.toFixed(2)})`
        );
      }
    }
  }

  await db
    .prepare(
      `INSERT INTO service_checks 
      (id, service_id, status, response_time_ms, status_code, error_message, checked_at, 
       anomaly_detected, anomaly_type, anomaly_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      checkId,
      service_id,
      status,
      responseTime,
      statusCode,
      errorMessage,
      checkedAt,
      anomalyDetected ? 1 : 0,
      anomalyType,
      anomalyScore
    )
    .run();

  // Update KV snapshot
  const snapshot = {
    status,
    responseTime,
    statusCode,
    lastCheck: checkedAt,
    errorMessage,
  };
  await env.STATUS_SNAPSHOTS.put(
    `service:${service_id}`,
    JSON.stringify(snapshot),
    { expirationTtl: 86400 } // 24 hours
  );

  // Update Durable Object state with optimized batch mode
  const { updateServiceState } = await import('./utils/durable-objects');
  await updateServiceState(env, service_id, status, checkedAt, status === 'down' || status === 'degraded');

  // Handle incident logic
  const { handleIncidentLogic } = await import('./utils/incidents');
  await handleIncidentLogic(service_id, status, env);
}

/**
 * HTTP health check
 */
async function checkHttp(
  url: string,
  timeoutMs: number,
  expectedStatusCode?: number | null,
  expectedKeyword?: string | null
): Promise<{
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  statusCode: number | null;
  errorMessage: string | null;
}> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Ensure URL has protocol
    let fullUrl = url.startsWith('http') ? url : `https://${url}`;

    // Remove trailing slash if present (can cause issues with some servers)
    if (fullUrl.endsWith('/')) {
      fullUrl = fullUrl.slice(0, -1);
    }

    console.log(`[HTTP Check] Checking: ${fullUrl}`);

    const response = await fetch(fullUrl, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow', // Follow redirects (HTTP -> HTTPS is normal)
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
      },
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    const statusCode = response.status;

    console.log(`[HTTP Check] ${fullUrl} - Status: ${statusCode}, OK: ${response.ok}`);

    // Check status code (only if explicitly expected)
    if (expectedStatusCode && statusCode !== expectedStatusCode) {
      // If we got a redirect (3xx) but expected a different code, that's still OK
      // Redirects are normal behavior (HTTP -> HTTPS)
      if (statusCode >= 300 && statusCode < 400) {
        // Redirect is OK, continue with normal processing
      } else {
        return {
          status: 'down',
          responseTime,
          statusCode,
          errorMessage: `Expected status ${expectedStatusCode}, got ${statusCode}`,
        };
      }
    }

    // Check keyword (only if explicitly expected) - read body only if needed
    if (expectedKeyword) {
      try {
        const text = await response.text();
        if (!text.includes(expectedKeyword)) {
          return {
            status: 'down',
            responseTime,
            statusCode,
            errorMessage: `Expected keyword not found: ${expectedKeyword}`,
          };
        }
      } catch (textError: any) {
        // If reading text fails, we can't check keyword, but status code check already passed
        console.warn(`[HTTP Check] Failed to read response body for keyword check: ${textError.message}`);
        // Continue with status code check
      }
    }

    // Determine status based on HTTP status code
    // 2xx and 3xx (redirects) are considered UP
    // 4xx are degraded (client errors but server is responding)
    // 5xx are down (server errors)
    let status: 'up' | 'down' | 'degraded' = 'up';
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

    return {
      status,
      responseTime,
      statusCode,
      errorMessage: responseTime > 3000 ? 'High Response Time' : null,
    };
  } catch (error: any) {
    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    return {
      status: 'down',
      responseTime,
      statusCode: null,
      errorMessage: error.message || 'Request failed',
    };
  }
}

/**
 * Handle incident creation and resolution logic
 */
async function handleIncidentLogic(
  serviceId: string,
  status: 'up' | 'down' | 'degraded',
  env: Env
): Promise<void> {
  const db = env.DB;

  // Get service info
  const service = await db
    .prepare('SELECT * FROM monitored_services WHERE id = ?')
    .bind(serviceId)
    .first<{
      id: string;
      user_id: string;
      name: string;
      url_or_host: string;
      notify_telegram: number;
      notify_email: number;
    }>();

  if (!service) {
    return;
  }

  // Check for open incidents
  const openIncident = await db
    .prepare(
      "SELECT * FROM incidents WHERE service_id = ? AND status != 'resolved' ORDER BY started_at DESC LIMIT 1"
    )
    .bind(serviceId)
    .first();

  // If service is down and no open incident, create one
  if (status === 'down' && !openIncident) {
    const incidentId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO incidents 
        (id, service_id, status, title, description, started_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        incidentId,
        serviceId,
        'open',
        `${service.name} is down`,
        `Service ${service.name} is currently down.`,
        now,
        now,
        now
      )
      .run();

    // Create initial update
    const updateId = crypto.randomUUID();
    await db
      .prepare(
        'INSERT INTO incident_updates (id, incident_id, message, status, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(updateId, incidentId, 'Service is down', 'investigating', now)
      .run();

    // Send notifications
    if (service.notify_telegram || service.notify_email) {
      await sendNotifications(
        { id: service.id, user_id: service.user_id, name: service.name, url_or_host: service.url_or_host },
        incidentId,
        'down',
        env
      );
    }
  }

  // If service is down and there's already an open incident, send notification on every check
  if (status === 'down' && openIncident) {
    // Send notification on every check for down services
    if (service.notify_telegram || service.notify_email) {
      await sendNotifications(
        { id: service.id, user_id: service.user_id, name: service.name, url_or_host: service.url_or_host },
        openIncident.id,
        'down',
        env
      );
    }
  }

  // If service is degraded, send notification
  if (status === 'degraded') {
    // Check if there's already a degraded incident
    const degradedIncident = await db
      .prepare(
        "SELECT * FROM incidents WHERE service_id = ? AND status != 'resolved' AND title LIKE '%degraded%' ORDER BY started_at DESC LIMIT 1"
      )
      .bind(serviceId)
      .first();

    if (!degradedIncident) {
      // Create new degraded incident
      const incidentId = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);

      await db
        .prepare(
          `INSERT INTO incidents 
          (id, service_id, status, title, description, started_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          incidentId,
          serviceId,
          'open',
          `${service.name} is degraded`,
          `Service ${service.name} is experiencing degraded performance.`,
          now,
          now,
          now
        )
        .run();

      // Create initial update
      const updateId = crypto.randomUUID();
      await db
        .prepare(
          'INSERT INTO incident_updates (id, incident_id, message, status, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(updateId, incidentId, 'Service is degraded', 'investigating', now)
        .run();

      // Send notification
      if (service.notify_telegram || service.notify_email) {
        await sendNotifications(
          { id: service.id, user_id: service.user_id, name: service.name, url_or_host: service.url_or_host },
          incidentId,
          'degraded',
          env
        );
      }
    } else {
      // Send notification on every check for degraded services
      if (service.notify_telegram || service.notify_email) {
        await sendNotifications(
          { id: service.id, user_id: service.user_id, name: service.name, url_or_host: service.url_or_host },
          degradedIncident.id,
          'degraded',
          env
        );
      }
    }
  }

  // If service is up and there's an open incident (down or degraded), resolve it
  if (status === 'up' && openIncident) {
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        "UPDATE incidents SET status = 'resolved', resolved_at = ?, updated_at = ? WHERE id = ?"
      )
      .bind(now, now, openIncident.id)
      .run();

    // Add resolution update
    const updateId = crypto.randomUUID();
    const resolutionMessage = openIncident.title?.includes('degraded')
      ? 'Service performance is back to normal'
      : 'Service is back up';

    await db
      .prepare(
        'INSERT INTO incident_updates (id, incident_id, message, status, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(
        updateId,
        openIncident.id,
        resolutionMessage,
        'resolved',
        now
      )
      .run();

    // Send recovery notification
    if (service.notify_telegram || service.notify_email) {
      await sendNotifications(
        { id: service.id, user_id: service.user_id, name: service.name, url_or_host: service.url_or_host },
        openIncident.id,
        'up',
        env
      );
    }
  }
}

/**
 * Calculate uptime percentages for all services (24h, 7d, 30d)
 * Stores results in KV for status page cache
 */
async function calculateUptimePercentages(db: D1Database, env: Env): Promise<void> {
  console.log('Calculating uptime percentages...');

  try {
    const services = await db
      .prepare('SELECT id FROM monitored_services WHERE is_active = 1')
      .all<{ id: string }>();

    const now = Math.floor(Date.now() / 1000);
    const periods = {
      '24h': 24 * 60 * 60,
      '7d': 7 * 24 * 60 * 60,
      '30d': 30 * 24 * 60 * 60,
    };

    for (const service of services.results || []) {
      const uptimeData: Record<string, { uptime: number; total: number; down: number }> = {};

      for (const [period, seconds] of Object.entries(periods)) {
        const since = now - seconds;

        // Get all checks in the period
        const checks = await db
          .prepare(
            'SELECT status FROM service_checks WHERE service_id = ? AND checked_at >= ? ORDER BY checked_at'
          )
          .bind(service.id, since)
          .all<{ status: string }>();

        const total = checks.results?.length || 0;
        const down = checks.results?.filter((c) => c.status === 'down').length || 0;
        const up = total - down;
        const uptime = total > 0 ? (up / total) * 100 : 100;

        uptimeData[period] = {
          uptime: Math.round(uptime * 100) / 100, // Round to 2 decimals
          total,
          down,
        };
      }

      // Store in KV
      await env.STATUS_PAGE_CACHE.put(
        `uptime:${service.id}`,
        JSON.stringify({
          ...uptimeData,
          calculatedAt: now,
        }),
        { expirationTtl: 3600 } // 1 hour
      );
    }

    console.log(`Calculated uptime for ${services.results?.length || 0} services`);
  } catch (error) {
    console.error('Error calculating uptime:', error);
  }
}

/**
 * Send notifications (Telegram and Email)
 */
async function sendNotifications(
  service: { id: string; user_id: string; name: string; url_or_host?: string },
  incidentId: string,
  event: 'down' | 'up' | 'degraded' | 'new',
  env: Env
): Promise<void> {
  const db = env.DB;

  // Get user integrations
  const integration = await db
    .prepare('SELECT * FROM integrations WHERE user_id = ? AND is_active = 1')
    .bind(service.user_id)
    .first<{
      telegram_chat_id: string | null;
      email_address: string | null;
    }>();

  if (!integration) {
    return;
  }

  // Build message with service name and URL
  const serviceUrl = service.url_or_host || 'N/A';
  let message = '';
  let subject = '';

  switch (event) {
    case 'down':
      message = `🚨 Alert: ${service.name} is down!\n\n📍 URL: ${serviceUrl}\n🆔 Incident ID: ${incidentId}`;
      subject = `Alert: ${service.name} is down`;
      break;
    case 'degraded':
      message = `⚠️ Warning: ${service.name} is degraded!\n\n📍 URL: ${serviceUrl}\n🆔 Incident ID: ${incidentId}`;
      subject = `Warning: ${service.name} is degraded`;
      break;
    case 'up':
      message = `✅ Recovery: ${service.name} is back up!\n\n📍 URL: ${serviceUrl}\n🆔 Incident ID: ${incidentId}`;
      subject = `Recovery: ${service.name} is up`;
      break;
    case 'new':
      message = `🆕 New Service Added: ${service.name}\n\n📍 URL: ${serviceUrl}\n✅ Monitoring started`;
      subject = `New Service: ${service.name}`;
      break;
  }

  // Send Telegram notification
  if (integration.telegram_chat_id && env.TELEGRAM_BOT_TOKEN) {
    try {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: integration.telegram_chat_id,
          text: message,
        }),
      });
    } catch (error) {
      console.error('Error sending Telegram notification:', error);
    }
  }

  // Send Email notification via MailChannels
  if (integration.email_address && env.MAILCHANNELS_API_KEY) {
    try {
      await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.MAILCHANNELS_API_KEY}`,
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: integration.email_address }],
            },
          ],
          from: {
            email: 'noreply@upto.dev',
            name: 'Upto Monitoring',
          },
          subject: subject,
          content: [
            {
              type: 'text/plain',
              value: message,
            },
          ],
        }),
      });
    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  }
}

