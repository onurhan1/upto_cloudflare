// Rate limiting utility using KV storage

import { Env } from '../types';

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowSeconds: 60, // 1 minute
};

/**
 * Rate limit middleware
 */
export async function rateLimit(
  identifier: string,
  env: Env,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  // Use KV for rate limiting (or D1 if KV not available)
  const key = `rate_limit:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % config.windowSeconds);

  try {
    // Try KV first
    if (env.RATE_LIMIT_KV) {
      const stored = await env.RATE_LIMIT_KV.get(key);
      let count = 0;
      let resetAt = windowStart + config.windowSeconds;

      if (stored) {
        const data = JSON.parse(stored);
        if (data.windowStart === windowStart) {
          count = data.count;
        }
      }

      if (count >= config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetAt,
        };
      }

      count++;
      await env.RATE_LIMIT_KV.put(
        key,
        JSON.stringify({ count, windowStart }),
        { expirationTtl: config.windowSeconds }
      );

      return {
        allowed: true,
        remaining: config.maxRequests - count,
        resetAt,
      };
    }

    // Fallback to D1 if KV not available
    try {
      const db = env.DB;
      const result = await db
        .prepare('SELECT count, window_start FROM rate_limits WHERE key = ?')
        .bind(key)
        .first<{ count: number; window_start: number }>();

      const resetAt = windowStart + config.windowSeconds;
      let count = 0;

      if (result && result.window_start === windowStart) {
        count = result.count;
      }

      if (count >= config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetAt,
        };
      }

      count++;
      // Try INSERT first, if table doesn't exist, it will fail gracefully
      await db
        .prepare(
          'INSERT INTO rate_limits (key, count, window_start, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET count = ?, window_start = ?, expires_at = ?'
        )
        .bind(key, count, windowStart, resetAt, count, windowStart, resetAt)
        .run();
    } catch (dbError: any) {
      // If table doesn't exist or any DB error, just allow the request
      console.warn('Rate limit DB error (allowing request):', dbError.message);
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: windowStart + config.windowSeconds,
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - count,
      resetAt,
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    // On error, allow the request (fail open)
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: windowStart + config.windowSeconds,
    };
  }
}

/**
 * Create rate limit middleware for Hono
 */
export function rateLimitMiddleware(config?: Partial<RateLimitConfig>) {
  const limitConfig = { ...DEFAULT_CONFIG, ...config };
  
  return async (c: any, next: () => Promise<void>) => {
    try {
      // Get identifier (IP address or user ID)
      const identifier = c.req.header('CF-Connecting-IP') || 
                        c.get('user')?.id || 
                        'anonymous';
      
      const result = await rateLimit(identifier, c.env, limitConfig);
      
      if (!result.allowed) {
        return c.json(
          {
            error: 'Rate limit exceeded',
            resetAt: result.resetAt,
          },
          429
        );
      }

      // Add rate limit headers
      c.header('X-RateLimit-Limit', limitConfig.maxRequests.toString());
      c.header('X-RateLimit-Remaining', result.remaining.toString());
      c.header('X-RateLimit-Reset', result.resetAt.toString());
    } catch (error) {
      // If rate limiting fails, allow the request (fail-open)
      console.warn('Rate limiting error (allowing request):', error);
    }

    await next();
  };
}

