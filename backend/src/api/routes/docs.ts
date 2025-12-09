// OpenAPI/Swagger documentation endpoint

import { Hono } from 'hono';
import { Env } from '../../types';

const docs = new Hono<{ Bindings: Env }>();

/**
 * GET /docs
 * OpenAPI/Swagger documentation
 */
docs.get('/', async (c) => {
  const openApiSpec = {
    openapi: '3.0.0',
    info: {
      title: 'Upto API',
      version: '1.0.0',
      description: 'Uptime Monitoring + Incident Management + Status Page API',
    },
    servers: [
      {
        url: 'http://localhost:8787',
        description: 'Local development',
      },
      {
        url: 'https://api.upto.dev',
        description: 'Production',
      },
    ],
    paths: {
      '/health': {
        get: {
          summary: 'Health check',
          tags: ['Health'],
          responses: {
            '200': {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      service: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/auth/register': {
        post: {
          summary: 'Register a new user',
          tags: ['Authentication'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password', 'name'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'User created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      token: { type: 'string' },
                      user: { $ref: '#/components/schemas/User' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/auth/login': {
        post: {
          summary: 'Login',
          tags: ['Authentication'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Login successful',
            },
          },
        },
      },
      '/services': {
        get: {
          summary: 'List services',
          tags: ['Services'],
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'List of services',
            },
          },
        },
        post: {
          summary: 'Create service',
          tags: ['Services'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Service' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Service created',
            },
          },
        },
      },
      '/services/{id}': {
        get: {
          summary: 'Get service details',
          tags: ['Services'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Service details',
            },
          },
        },
      },
      '/incidents': {
        get: {
          summary: 'List incidents',
          tags: ['Incidents'],
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'List of incidents',
            },
          },
        },
      },
      '/status-page/mine': {
        get: {
          summary: 'List user status pages',
          tags: ['Status Pages'],
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'List of status pages',
            },
          },
        },
      },
      '/public/status/{slug}': {
        get: {
          summary: 'Get public status page',
          tags: ['Public'],
          parameters: [
            {
              name: 'slug',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Status page data',
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'user', 'readonly'] },
          },
        },
        Service: {
          type: 'object',
          required: ['name', 'type', 'url_or_host'],
          properties: {
            name: { type: 'string' },
            type: { type: 'string', enum: ['http', 'api', 'ping', 'dns', 'ssl', 'domain'] },
            url_or_host: { type: 'string' },
            port: { type: 'integer' },
            check_interval_seconds: { type: 'integer', default: 60 },
            timeout_ms: { type: 'integer', default: 5000 },
            expected_status_code: { type: 'integer' },
            expected_keyword: { type: 'string' },
            notify_telegram: { type: 'boolean', default: false },
            notify_email: { type: 'boolean', default: false },
          },
        },
        Incident: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            service_id: { type: 'string' },
            status: { type: 'string', enum: ['open', 'monitoring', 'resolved'] },
            title: { type: 'string' },
            description: { type: 'string' },
            started_at: { type: 'integer' },
            resolved_at: { type: 'integer' },
          },
        },
      },
    },
  };

  return c.json(openApiSpec);
});

/**
 * GET /docs/swagger
 * Swagger UI HTML page
 */
docs.get('/swagger', async (c) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Upto API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/docs',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>
  `;

  return c.html(html);
});

export default docs;

