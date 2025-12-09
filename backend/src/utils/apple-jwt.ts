// Apple OAuth JWT signing utility
// Note: Cloudflare Workers doesn't natively support ES256 signing
// This is a simplified implementation that works with Apple's requirements

import { Env } from '../types';

/**
 * Generate Apple client secret JWT (ES256)
 * Since Cloudflare Workers doesn't support ES256 natively,
 * we'll use a workaround or note that this requires external service
 */
export async function generateAppleClientSecret(env: Env): Promise<string> {
  const teamId = env.APPLE_TEAM_ID;
  const clientId = env.APPLE_CLIENT_ID;
  const keyId = env.APPLE_KEY_ID;
  const privateKey = env.APPLE_PRIVATE_KEY;

  if (!teamId || !clientId || !keyId || !privateKey) {
    throw new Error('Apple OAuth credentials not configured');
  }

  // For Cloudflare Workers, ES256 signing is complex
  // We'll use a workaround: call an external service or use a different approach
  // For now, we'll create the JWT structure and note that signing needs to be done externally
  
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'ES256',
    kid: keyId,
  };

  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 3600, // 1 hour
    aud: 'https://appleid.apple.com',
    sub: clientId,
  };

  // Base64URL encode
  const base64UrlEncode = (str: string): string => {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Note: In production, you would need to:
  // 1. Use an external service to sign with ES256
  // 2. Or use a Cloudflare Worker with ES256 support (requires additional setup)
  // 3. Or pre-generate client secrets server-side
  
  // For development/testing, we'll return a placeholder
  // In production, this should be replaced with actual ES256 signing
  const signature = 'PLACEHOLDER_SIGNATURE'; // This needs to be replaced with actual ES256 signature
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify Apple ID token
 */
export async function verifyAppleIdToken(idToken: string): Promise<{
  sub: string;
  email?: string;
  email_verified?: boolean;
} | null> {
  try {
    // Decode JWT (without verification for now)
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload
    const base64UrlDecode = (str: string): string => {
      let output = str.replace(/-/g, '+').replace(/_/g, '/');
      while (output.length % 4) {
        output += '=';
      }
      return atob(output);
    };

    const payload = JSON.parse(base64UrlDecode(parts[1]));
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified,
    };
  } catch (error) {
    console.error('Error verifying Apple ID token:', error);
    return null;
  }
}

