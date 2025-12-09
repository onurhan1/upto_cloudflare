// Middleware for Hono.js API

import { Context, Next } from 'hono';
import { verifyToken, extractToken } from './auth';
import { Env } from '../types';

/**
 * Authentication middleware
 * Verifies JWT token and attaches user info to context
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
) {
  const authHeader = c.req.header('Authorization');
  const token = extractToken(authHeader);

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const secret = c.env.JWT_SECRET;
  if (!secret) {
    return c.json({ error: 'Server configuration error' }, 500);
  }

  const payload = await verifyToken(token, secret);
  if (!payload || payload.exp < Date.now() / 1000) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  // Attach user info to context (including organizationId from JWT if present)
  c.set('user', {
    id: payload.userId,
    email: payload.email,
    role: payload.role,
    organizationId: payload.organizationId, // Optional: current organization context
  });

  return next();
}

/**
 * Role-based access control middleware
 */
export function requireRole(...allowedRoles: string[]) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    return next();
  };
}

/**
 * CORS middleware
 */
export async function corsMiddleware(c: Context, next: Next) {
  const origin = c.req.header('Origin');
  const allowedOrigins = [
    'http://localhost:3000',
    'https://upto.pages.dev',
    'https://uptocloudflare2-frontend.pages.dev',
  ];

  // Allow all pages.dev subdomains for preview deployments
  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.pages.dev'))) {
    c.header('Access-Control-Allow-Origin', origin);
  }

  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Organization-ID, X-Project-ID');
  c.header('Access-Control-Allow-Credentials', 'true');

  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }

  return next();
}

