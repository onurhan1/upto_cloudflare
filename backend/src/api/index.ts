// Main API router - Hono.js application

import { Hono } from 'hono';
import { corsMiddleware, authMiddleware } from '../utils/middleware';
import { rateLimitMiddleware } from '../utils/rate-limit';
import { logger } from '../utils/logger';
import { Env } from '../types';

// Import routes
import auth from './routes/auth';
import services from './routes/services';
import incidents from './routes/incidents';
import statusPage from './routes/status-page';
import integrations from './routes/integrations';
import publicRoutes from './routes/public';
import telegram from './routes/telegram';
import r2 from './routes/r2';
import oauth from './routes/oauth';
import docs from './routes/docs';
import settings from './routes/settings';
import organizations from './routes/organizations';
import projects from './routes/projects';
import invitations from './routes/invitations';
import audit from './routes/audit';

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('/*', corsMiddleware);

// Rate limiting for public endpoints
// Note: Rate limiting will fail gracefully if KV/D1 not configured (fail-open)
app.use('/auth/*', rateLimitMiddleware({ maxRequests: 10, windowSeconds: 60 }));
app.use('/oauth/*', rateLimitMiddleware({ maxRequests: 20, windowSeconds: 60 }));
app.use('/public/*', rateLimitMiddleware({ maxRequests: 100, windowSeconds: 60 }));

// Logging middleware with trace_id
app.use('/*', async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  
  // Generate or extract trace ID from header
  const traceId = c.req.header('X-Trace-Id') || logger.generateTraceId();
  c.set('traceId', traceId);
  
  // Create child logger with trace ID
  const requestLogger = logger.withTrace(traceId);
  
  // Get user context if available
  const user = c.get('user');
  const organization = c.get('organization');
  
  requestLogger.info('Request started', {
    method,
    path,
    userId: user?.id,
    organizationId: organization?.organizationId,
  });
  
  await next();
  
  const duration = Date.now() - start;
  const status = c.res.status;
  
  requestLogger.info('Request completed', {
    method,
    path,
    status,
    duration,
    userId: user?.id,
    organizationId: organization?.organizationId,
  });
});

// Global error handler
import { errorHandler } from '../utils/errors';
app.onError(errorHandler);

// Root endpoint
app.get('/', async (c) => {
  return c.json({
    service: 'Upto API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: {
        register: 'POST /auth/register',
        login: 'POST /auth/login',
      },
      services: 'GET /services',
      incidents: 'GET /incidents',
      statusPage: 'GET /status-page/mine',
      integrations: 'GET /integrations',
      public: 'GET /public/status/:slug',
    },
  });
});

// Health check (no auth)
app.get('/health', async (c) => {
  return c.json({ status: 'ok', service: 'upto-api' });
});

// Public routes
app.route('/public', publicRoutes);

// Invitation routes (partially public)
app.route('/invitations', invitations);

// Auth routes (no auth required)
app.route('/auth', auth);

// OAuth routes (no auth required)
app.route('/oauth', oauth);

// Protected routes
app.route('/organizations', organizations);
app.route('/projects', projects);
app.route('/services', services);
app.route('/incidents', incidents);
app.route('/status-page', statusPage);
app.route('/integrations', integrations);
app.route('/settings', settings);
app.route('/audit', audit);
app.route('/r2', r2);

// Telegram webhook (no auth required, uses bot token)
app.route('/telegram', telegram);

// API Documentation (public)
app.route('/docs', docs);

// User routes
app.get('/users/me', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.json({ user });
});

export default app;

