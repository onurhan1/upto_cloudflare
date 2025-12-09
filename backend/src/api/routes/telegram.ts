// Telegram Bot webhook handler

import { Hono } from 'hono';
import { Env } from '../../types';

const telegram = new Hono<{ Bindings: Env }>();

/**
 * POST /telegram/webhook
 * Telegram webhook endpoint
 */
telegram.post('/webhook', async (c) => {
  try {
    const body = await c.req.json();
    const botToken = c.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return c.json({ error: 'Telegram bot not configured' }, 500);
    }

    // Handle different update types
    if (body.message) {
      const message = body.message;
      const chatId = message.chat.id;
      const text = message.text || '';

      // Handle commands
      if (text.startsWith('/start')) {
        const responseText =
          'Welcome to Upto Monitoring Bot!\n\n' +
          'Commands:\n' +
          '/services - List your services\n' +
          '/status <service_id> - Get service status\n' +
          '/incidents - List open incidents\n\n' +
          'To link your account, use the token from your dashboard.';

        await sendTelegramMessage(botToken, chatId, responseText);
        return c.json({ ok: true });
      }

      if (text.startsWith('/services')) {
        // Get user's services (would need to link chat_id to user_id)
        const db = c.env.DB;
        const integration = await db
          .prepare('SELECT user_id FROM integrations WHERE telegram_chat_id = ?')
          .bind(chatId.toString())
          .first<{ user_id: string }>();

        if (!integration) {
          await sendTelegramMessage(
            botToken,
            chatId,
            'Please link your Telegram account in the dashboard first.'
          );
          return c.json({ ok: true });
        }

        const services = await db
          .prepare('SELECT id, name, is_active FROM monitored_services WHERE user_id = ? LIMIT 10')
          .bind(integration.user_id)
          .all();

        if (services.results && services.results.length > 0) {
          let responseText = 'Your Services:\n\n';
          for (const service of services.results) {
            const status = service.is_active ? '✅ Active' : '❌ Inactive';
            responseText += `${status} ${service.name} (${service.id})\n`;
          }
          await sendTelegramMessage(botToken, chatId, responseText);
        } else {
          await sendTelegramMessage(botToken, chatId, 'No services found.');
        }

        return c.json({ ok: true });
      }

      if (text.startsWith('/status')) {
        const parts = text.split(' ');
        const serviceId = parts[1];

        if (!serviceId) {
          await sendTelegramMessage(
            botToken,
            chatId,
            'Usage: /status <service_id>'
          );
          return c.json({ ok: true });
        }

        const db = c.env.DB;
        const integration = await db
          .prepare('SELECT user_id FROM integrations WHERE telegram_chat_id = ?')
          .bind(chatId.toString())
          .first<{ user_id: string }>();

        if (!integration) {
          await sendTelegramMessage(
            botToken,
            chatId,
            'Please link your Telegram account in the dashboard first.'
          );
          return c.json({ ok: true });
        }

        // Get service status from KV
        const snapshot = await c.env.STATUS_SNAPSHOTS.get(`service:${serviceId}`);
        if (snapshot) {
          const status = JSON.parse(snapshot);
          const statusEmoji = status.status === 'up' ? '✅' : status.status === 'down' ? '❌' : '⚠️';
          const responseText =
            `${statusEmoji} Service Status\n\n` +
            `Status: ${status.status}\n` +
            `Response Time: ${status.responseTime || 'N/A'}ms\n` +
            `Last Check: ${new Date(status.lastCheck * 1000).toLocaleString()}`;

          await sendTelegramMessage(botToken, chatId, responseText);
        } else {
          await sendTelegramMessage(botToken, chatId, 'Service status not available.');
        }

        return c.json({ ok: true });
      }

      if (text.startsWith('/incidents')) {
        const db = c.env.DB;
        const integration = await db
          .prepare('SELECT user_id FROM integrations WHERE telegram_chat_id = ?')
          .bind(chatId.toString())
          .first<{ user_id: string }>();

        if (!integration) {
          await sendTelegramMessage(
            botToken,
            chatId,
            'Please link your Telegram account in the dashboard first.'
          );
          return c.json({ ok: true });
        }

        const incidents = await db
          .prepare(
            `SELECT i.*, ms.name as service_name 
             FROM incidents i
             JOIN monitored_services ms ON i.service_id = ms.id
             WHERE ms.user_id = ? AND i.status != 'resolved'
             ORDER BY i.started_at DESC
             LIMIT 5`
          )
          .bind(integration.user_id)
          .all();

        if (incidents.results && incidents.results.length > 0) {
          let responseText = 'Open Incidents:\n\n';
          for (const incident of incidents.results) {
            responseText += `🚨 ${incident.service_name}\n${incident.title}\n\n`;
          }
          await sendTelegramMessage(botToken, chatId, responseText);
        } else {
          await sendTelegramMessage(botToken, chatId, 'No open incidents.');
        }

        return c.json({ ok: true });
      }

      // Default response
      await sendTelegramMessage(
        botToken,
        chatId,
        'Unknown command. Use /start to see available commands.'
      );
    }

    return c.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Send message via Telegram Bot API
 */
async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    });
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}

export default telegram;

