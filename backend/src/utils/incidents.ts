// Incident management utilities

import { Env } from '../types';

/**
 * Handle incident creation and resolution logic
 */
interface IncidentRetryConfig {
  maxRetries: number;
  retryDelayMs: number;
  retryBackoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: IncidentRetryConfig = {
  maxRetries: 3,
  retryDelayMs: 5000, // 5 seconds
  retryBackoffMultiplier: 2,
};

/**
 * Auto-retry logic for incident creation
 */
async function retryIncidentOperation<T>(
  operation: () => Promise<T>,
  config: IncidentRetryConfig = DEFAULT_RETRY_CONFIG,
  attempt: number = 1
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (attempt >= config.maxRetries) {
      throw error;
    }

    const delay = config.retryDelayMs * Math.pow(config.retryBackoffMultiplier, attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delay));

    return retryIncidentOperation(operation, config, attempt + 1);
  }
}

export async function handleIncidentLogic(
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

    // Get recent checks for AI summary
    const recentChecks = await db
      .prepare(
        `SELECT * FROM service_checks 
         WHERE service_id = ? 
         ORDER BY checked_at DESC LIMIT 20`
      )
      .bind(serviceId)
      .all<{
        status: string;
        response_time_ms: number | null;
        status_code: number | null;
        error_message: string | null;
        checked_at: number;
        anomaly_detected?: number;
        anomaly_type?: string;
      }>();

    // Generate AI summary asynchronously (don't block incident creation)
    (async () => {
      try {
        const { generateIncidentSummary } = await import('./ai');
        const aiSummary = await generateIncidentSummary(
          incidentId,
          service.name,
          service.url_or_host,
          `${service.name} is down`,
          `Service ${service.name} is currently down.`,
          recentChecks.results || [],
          env,
          service.user_id // Pass user_id to fetch API key from database
        );

        if (aiSummary) {
          await db
            .prepare('UPDATE incidents SET ai_summary = ? WHERE id = ?')
            .bind(aiSummary, incidentId)
            .run();
        }
      } catch (error) {
        console.error('Error generating AI summary:', error);
        // Don't fail incident creation if AI summary fails
      }
    })();

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

      // Get recent checks for AI summary
      const recentChecks = await db
        .prepare(
          `SELECT * FROM service_checks 
           WHERE service_id = ? 
           ORDER BY checked_at DESC LIMIT 20`
        )
        .bind(serviceId)
        .all<{
          status: string;
          response_time_ms: number | null;
          status_code: number | null;
          error_message: string | null;
          checked_at: number;
          anomaly_detected?: number;
          anomaly_type?: string;
        }>();

      // Generate AI summary asynchronously
      (async () => {
        try {
          const { generateIncidentSummary } = await import('./ai');
          const aiSummary = await generateIncidentSummary(
            incidentId,
            service.name,
            service.url_or_host,
            `${service.name} is degraded`,
            `Service ${service.name} is experiencing degraded performance.`,
            recentChecks.results || [],
            env,
            service.user_id // Pass user_id to fetch API key from database
          );

          if (aiSummary) {
            await db
              .prepare('UPDATE incidents SET ai_summary = ? WHERE id = ?')
              .bind(aiSummary, incidentId)
              .run();
          }
        } catch (error) {
          console.error('Error generating AI summary:', error);
        }
      })();

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
 * Send notifications (Telegram and Email)
 */
export async function sendNotifications(
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
      const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: integration.telegram_chat_id,
          text: message,
        }),
      });
      
      const result = await response.json();
      if (!result.ok) {
        console.error('Telegram API error:', result);
      } else {
        console.log('Telegram notification sent successfully to chat:', integration.telegram_chat_id);
      }
    } catch (error) {
      console.error('Error sending Telegram notification:', error);
    }
  } else {
    if (!integration.telegram_chat_id) {
      console.warn('Telegram notification skipped: telegram_chat_id is not set in integration');
    }
    if (!env.TELEGRAM_BOT_TOKEN) {
      console.warn('Telegram notification skipped: TELEGRAM_BOT_TOKEN is not configured');
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

