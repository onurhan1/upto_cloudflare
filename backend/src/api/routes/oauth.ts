// OAuth routes for Google and Apple Sign In

import { Hono } from 'hono';
import { Env } from '../../types';
import { generateToken } from '../../utils/auth';
import { generateUUID } from '../../utils/uuid';

const oauth = new Hono<{ Bindings: Env }>();

/**
 * Helper function to build redirect URI consistently
 * According to Google OAuth docs, redirect URI must match EXACTLY
 * https://developers.google.com/identity/protocols/oauth2/web-server#authorization-errors-redirect-uri-mismatch
 */
function buildRedirectUri(c: any): string {
  // For localhost, always use http://localhost:8787 (exact match required)
  const host = c.req.header('Host') || 'localhost:8787';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

  if (isLocalhost) {
    // For localhost, always use http://localhost:8787 (not https, not 127.0.0.1)
    return 'http://localhost:8787/oauth/google/callback';
  }

  // For production, use the actual protocol and host
  const protocol = c.req.header('X-Forwarded-Proto') || 'https';
  return `${protocol}://${host}/oauth/google/callback`;
}

/**
 * GET /oauth/google
 * Initiate Google OAuth flow
 */
oauth.get('/google', async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const env = c.env.ENVIRONMENT || 'development';

  // Build redirect URI - must be consistent with callback
  const redirectUri = c.req.query('redirect_uri') || buildRedirectUri(c);
  const state = c.req.query('state') || generateUUID();

  // Development mode: Allow mock OAuth if no credentials
  if ((!clientId || clientId === '') && env === 'development') {
    // Mock OAuth for development - create a test user directly
    const frontendUrl = c.req.query('frontend_url') || c.env.FRONTEND_URL || 'http://localhost:3000';
    const db = c.env.DB;

    // Create a mock Google user
    const mockEmail = `google_test_${Date.now()}@example.com`;
    const userId = generateUUID();
    const now = Math.floor(Date.now() / 1000);

    // Check if test user exists
    let user = await db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(mockEmail)
      .first<{
        id: string;
        email: string;
        name: string;
        role: string;
      }>();

    if (!user) {
      await db
        .prepare(
          'INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(userId, mockEmail, '', 'Google Test User', 'user', now, now)
        .run();

      // Create default integration
      const integrationId = generateUUID();
      await db
        .prepare(
          'INSERT INTO integrations (id, user_id, email_address, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(integrationId, userId, mockEmail, 1, now, now)
        .run();

      user = {
        id: userId,
        email: mockEmail,
        name: 'Google Test User',
        role: 'user',
      };
    }

    // Generate token
    const token = await generateToken(user.id, user.email, user.role, c.env.JWT_SECRET);

    // Redirect to frontend with token
    return c.redirect(`${frontendUrl}/auth/callback?token=${token}&provider=google&mock=true`);
  }

  if (!clientId || clientId === '') {
    // Return a helpful error page for browser requests
    const acceptHeader = c.req.header('Accept') || '';
    const userAgent = c.req.header('User-Agent') || '';
    const isBrowser = acceptHeader.includes('text/html') || userAgent.includes('Mozilla');

    if (isBrowser) {
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>OAuth Configuration Required</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            .container {
              background: white;
              max-width: 600px;
              width: 100%;
              border-radius: 12px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              padding: 40px;
            }
            .error { 
              background: #fee;
              border-left: 4px solid #f44;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 20px;
            }
            .error h2 { color: #c33; margin-bottom: 10px; }
            .info { 
              background: #f0f7ff;
              border-left: 4px solid #4a90e2;
              padding: 20px;
              border-radius: 8px;
            }
            .info h3 { color: #2c5aa0; margin-bottom: 15px; }
            .info ol { margin-left: 20px; margin-top: 10px; }
            .info li { margin-bottom: 10px; line-height: 1.6; }
            code { 
              background: #f5f5f5;
              padding: 3px 8px;
              border-radius: 4px;
              font-family: 'Monaco', 'Courier New', monospace;
              font-size: 0.9em;
            }
            pre {
              background: #2d2d2d;
              color: #f8f8f2;
              padding: 15px;
              border-radius: 6px;
              overflow-x: auto;
              margin: 10px 0;
            }
            pre code {
              background: transparent;
              color: inherit;
              padding: 0;
            }
            a {
              color: #4a90e2;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
            .back-link {
              display: inline-block;
              margin-top: 20px;
              padding: 10px 20px;
              background: #667eea;
              color: white;
              border-radius: 6px;
              transition: background 0.3s;
            }
            .back-link:hover {
              background: #5568d3;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">
              <h2>🔐 Google OAuth Not Configured</h2>
              <p>Google OAuth Client ID is not set. Please configure it to use Google Sign In.</p>
            </div>
            <div class="info">
              <h3>📋 Setup Instructions:</h3>
              <ol>
                <li>Get your Google OAuth credentials from <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a></li>
                <li>Set the secrets for production:
                  <pre><code>cd backend
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET</code></pre>
                </li>
                <li>For local development, edit <code>backend/wrangler.local.toml</code>:
                  <pre><code>[vars]
GOOGLE_CLIENT_ID = "your-client-id-here"
GOOGLE_CLIENT_SECRET = "your-client-secret-here"</code></pre>
                </li>
                <li>Restart the backend server after adding credentials</li>
              </ol>
              <a href="http://localhost:3000/login" class="back-link">← Back to Login</a>
            </div>
          </div>
        </body>
        </html>
      `, 500);
    }
    return c.json({ error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' }, 500);
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  return c.redirect(authUrl.toString());
});

/**
 * GET /oauth/google/callback
 * Handle Google OAuth callback
 */
oauth.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.json({ error: `OAuth error: ${error}` }, 400);
  }

  if (!code) {
    return c.json({ error: 'Authorization code not provided' }, 400);
  }

  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;

  // Build redirect URI - must match EXACTLY what was sent to Google
  // Use the same helper function to ensure consistency
  const redirectUri = buildRedirectUri(c);

  if (!clientId || !clientSecret) {
    return c.json({ error: 'Google OAuth not configured' }, 500);
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return c.json({ error: `Token exchange failed: ${errorText}` }, 400);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      return c.json({ error: 'Failed to fetch user info' }, 400);
    }

    const userInfo = await userInfoResponse.json<{
      id: string;
      email: string;
      verified_email: boolean;
      name: string;
      picture?: string;
    }>();

    if (!userInfo.email || !userInfo.verified_email) {
      return c.json({ error: 'Email not verified' }, 400);
    }

    const db = c.env.DB;

    // Check if user exists
    let user = await db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(userInfo.email)
      .first<{
        id: string;
        email: string;
        name: string;
        role: string;
      }>();

    // Create user if doesn't exist
    if (!user) {
      const userId = generateUUID();
      const now = Math.floor(Date.now() / 1000);

      await db
        .prepare(
          'INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          userId,
          userInfo.email,
          '', // OAuth users don't have password
          userInfo.name || userInfo.email.split('@')[0],
          'user',
          now,
          now
        )
        .run();

      // Create default integration
      const integrationId = generateUUID();
      await db
        .prepare(
          'INSERT INTO integrations (id, user_id, email_address, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(integrationId, userId, userInfo.email, 1, now, now)
        .run();

      user = {
        id: userId,
        email: userInfo.email,
        name: userInfo.name || userInfo.email.split('@')[0],
        role: 'user',
      };
    }

    // Generate JWT token
    const token = await generateToken(user.id, user.email, user.role, c.env.JWT_SECRET);

    // Redirect to frontend with token
    const frontendUrl = c.req.query('frontend_url') || c.env.FRONTEND_URL || 'http://localhost:3000';
    return c.redirect(`${frontendUrl}/auth/callback?token=${token}&provider=google`);
  } catch (error: any) {
    console.error('Google OAuth error:', error);
    return c.json({ error: 'OAuth authentication failed' }, 500);
  }
});

/**
 * GET /oauth/apple
 * Initiate Apple Sign In flow
 */
oauth.get('/apple', async (c) => {
  const clientId = c.env.APPLE_CLIENT_ID;
  const redirectUri = c.req.query('redirect_uri') || `${c.req.url.split('/oauth')[0]}/oauth/apple/callback`;
  const state = c.req.query('state') || generateUUID();

  if (!clientId) {
    return c.json({ error: 'Apple Sign In not configured' }, 500);
  }

  // Apple requires a form POST, so we'll return a page that auto-submits
  // For simplicity, we'll use a redirect with query params (Apple supports this)
  const authUrl = new URL('https://appleid.apple.com/auth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'name email');
  authUrl.searchParams.set('response_mode', 'form_post');
  authUrl.searchParams.set('state', state);

  return c.redirect(authUrl.toString());
});

/**
 * POST /oauth/apple/callback
 * Handle Apple Sign In callback (Apple uses POST)
 */
oauth.post('/apple/callback', async (c) => {
  const formData = await c.req.formData();
  const code = formData.get('code') as string;
  const state = formData.get('state') as string;
  const error = formData.get('error') as string;

  if (error) {
    return c.json({ error: `OAuth error: ${error}` }, 400);
  }

  if (!code) {
    return c.json({ error: 'Authorization code not provided' }, 400);
  }

  const clientId = c.env.APPLE_CLIENT_ID;
  const teamId = c.env.APPLE_TEAM_ID;
  const keyId = c.env.APPLE_KEY_ID;
  const privateKey = c.env.APPLE_PRIVATE_KEY;
  const redirectUri = `${c.req.url.split('/callback')[0]}/callback`;

  if (!clientId || !teamId || !keyId || !privateKey) {
    return c.json({ error: 'Apple Sign In not configured' }, 500);
  }

  try {
    // Import Apple JWT utility
    const { generateAppleClientSecret, verifyAppleIdToken } = await import('../../utils/apple-jwt');

    // Generate client secret JWT
    let clientSecret: string;
    try {
      clientSecret = await generateAppleClientSecret(c.env);
    } catch (jwtError: any) {
      console.error('Error generating Apple client secret:', jwtError);
      // Fallback: use private key directly if ES256 signing not available
      // Note: This is a workaround - in production, ES256 signing should be done properly
      clientSecret = privateKey; // Temporary workaround
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Apple token exchange failed:', errorText);
      return c.json({ error: `Apple OAuth failed: ${errorText}` }, 400);
    }

    const tokenData = await tokenResponse.json<{
      access_token?: string;
      id_token?: string;
      refresh_token?: string;
    }>();

    // Verify and extract user info from ID token
    let userEmail: string | null = null;
    let userName: string | null = null;

    if (tokenData.id_token) {
      const verifiedToken = await verifyAppleIdToken(tokenData.id_token);
      if (verifiedToken) {
        userEmail = verifiedToken.email || null;
        // Apple may provide name in the first request only
        // For subsequent requests, we'll use email or a default
      }
    }

    const db = c.env.DB;
    const userId = generateUUID();
    const userNow = Math.floor(Date.now() / 1000);

    // Use email from token, or generate a unique one
    const email = userEmail || `apple_${Date.now()}@apple.local`;

    // Check if user exists (by state or create new)
    let user = await db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first<{
        id: string;
        email: string;
        name: string;
        role: string;
      }>();

    if (!user) {
      const displayName = userName || email.split('@')[0] || 'Apple User';
      await db
        .prepare(
          'INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(userId, email, '', displayName, 'user', userNow, userNow)
        .run();

      // Create default integration
      const integrationId = generateUUID();
      await db
        .prepare(
          'INSERT INTO integrations (id, user_id, email_address, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(integrationId, userId, email, 1, userNow, userNow)
        .run();

      user = {
        id: userId,
        email,
        name: displayName,
        role: 'user',
      };
    }

    const token = await generateToken(user.id, user.email, user.role, c.env.JWT_SECRET);

    const frontendUrl = c.req.query('frontend_url') || c.env.FRONTEND_URL || 'http://localhost:3000';
    return c.redirect(`${frontendUrl}/auth/callback?token=${token}&provider=apple`);
  } catch (error: any) {
    console.error('Apple OAuth error:', error);
    return c.json({ error: 'OAuth authentication failed' }, 500);
  }
});

/**
 * GET /oauth/providers
 * Get available OAuth providers
 */
oauth.get('/providers', async (c) => {
  const providers: string[] = [];

  if (c.env.GOOGLE_CLIENT_ID) {
    providers.push('google');
  }

  if (c.env.APPLE_CLIENT_ID) {
    providers.push('apple');
  }

  return c.json({ providers });
});

export default oauth;

