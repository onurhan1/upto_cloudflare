// Settings routes for user API keys and preferences

import { Hono } from 'hono';
import { Env } from '../../types';
import { authMiddleware } from '../../utils/middleware';
import { generateUUID } from '../../utils/uuid';
import { encrypt, decrypt } from '../../utils/encryption';
import { hashPassword, verifyPassword } from '../../utils/auth';
import { logAction, getIpAddress, getUserAgent } from '../../utils/audit';

// D1Database type for getUserApiKey function
interface D1Database {
  prepare(query: string): any;
}

const settings = new Hono<{ Bindings: Env }>();

// All routes require authentication
settings.use('/*', authMiddleware);

/**
 * GET /settings/api-keys
 * Get user's API keys (masked for security)
 */
settings.get('/api-keys', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;

    const apiKeys = await db
      .prepare('SELECT id, api_provider, is_active, created_at, updated_at FROM user_api_keys WHERE user_id = ?')
      .bind(user.id)
      .all<{
        id: string;
        api_provider: string;
        is_active: number;
        created_at: number;
        updated_at: number;
      }>();

    return c.json({
      apiKeys: (apiKeys.results || []).map((key) => ({
        id: key.id,
        provider: key.api_provider,
        isActive: key.is_active === 1,
        createdAt: key.created_at,
        updatedAt: key.updated_at,
        // Don't return the actual key for security
      })),
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PUT /settings/api-keys/:provider
 * Create or update an API key for a provider
 */
settings.put('/api-keys/:provider', async (c) => {
  try {
    const user = c.get('user');
    const provider = c.req.param('provider') as 'openai' | 'anthropic' | 'google' | 'azure';
    const { apiKey } = await c.req.json();

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return c.json({ error: 'API key is required' }, 400);
    }

    // Validate provider
    const validProviders = ['openai', 'anthropic', 'google', 'azure'];
    if (!validProviders.includes(provider)) {
      return c.json({ error: 'Invalid API provider' }, 400);
    }

    const db = c.env.DB;
    const now = Math.floor(Date.now() / 1000);

    // Check if key already exists
    const existing = await db
      .prepare('SELECT id FROM user_api_keys WHERE user_id = ? AND api_provider = ?')
      .bind(user.id, provider)
      .first();

    // Encrypt the API key before storing
    const apiKeyEncrypted = await encrypt(apiKey, c.env);

    if (existing) {
      // Update existing key
      await db
        .prepare(
          'UPDATE user_api_keys SET api_key_encrypted = ?, updated_at = ?, is_active = 1 WHERE user_id = ? AND api_provider = ?'
        )
        .bind(apiKeyEncrypted, now, user.id, provider)
        .run();
    } else {
      // Create new key
      const keyId = generateUUID();
      await db
        .prepare(
          `INSERT INTO user_api_keys 
          (id, user_id, api_provider, api_key_encrypted, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(keyId, user.id, provider, apiKeyEncrypted, 1, now, now)
        .run();
    }

    return c.json({
      success: true,
      message: 'API key saved successfully',
    });
  } catch (error) {
    console.error('Error saving API key:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /settings/api-keys/:provider
 * Delete an API key
 */
settings.delete('/api-keys/:provider', async (c) => {
  try {
    const user = c.get('user');
    const provider = c.req.param('provider');

    const db = c.env.DB;

    await db
      .prepare('DELETE FROM user_api_keys WHERE user_id = ? AND api_provider = ?')
      .bind(user.id, provider)
      .run();

    return c.json({
      success: true,
      message: 'API key deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /settings/api-keys/:provider/decrypt
 * Get decrypted API key (for internal use only, e.g., when calling AI APIs)
 * This endpoint should only be used by the backend, not exposed to frontend
 */
export async function getUserApiKey(
  db: D1Database,
  userId: string,
  provider: 'openai' | 'anthropic' | 'google' | 'azure',
  env?: { ENCRYPTION_KEY?: string }
): Promise<string | null> {
  try {
    const result = await db
      .prepare('SELECT api_key_encrypted FROM user_api_keys WHERE user_id = ? AND api_provider = ? AND is_active = 1')
      .bind(userId, provider)
      .first<{ api_key_encrypted: string }>();

    if (!result) {
      return null;
    }

    // Decrypt the key
    try {
      const decrypted = await decrypt(result.api_key_encrypted, env);
      return decrypted;
    } catch (decryptError) {
      // If decryption fails, it might be an old plain text key
      // Try to use it as-is (for backward compatibility during migration)
      console.warn(`Failed to decrypt API key for ${provider}, trying as plain text (migration scenario)`);
      // Check if it looks like a plain API key (starts with common prefixes)
      if (result.api_key_encrypted.startsWith('sk-') || result.api_key_encrypted.startsWith('claude-')) {
        // It's likely a plain text key from before encryption was added
        // Re-encrypt it for future use
        try {
          const reEncrypted = await encrypt(result.api_key_encrypted, env);
          await db
            .prepare('UPDATE user_api_keys SET api_key_encrypted = ? WHERE user_id = ? AND api_provider = ?')
            .bind(reEncrypted, userId, provider)
            .run();
        } catch (reEncryptError) {
          console.error('Failed to re-encrypt key:', reEncryptError);
        }
        return result.api_key_encrypted;
      }
      throw decryptError;
    }
  } catch (error) {
    console.error(`Error getting API key for provider ${provider}:`, error);
    return null;
  }
}

/**
 * PATCH /settings/profile
 * Update user profile (name, email)
 */
settings.patch('/profile', async (c) => {
  try {
    const user = c.get('user');
    const { name, email } = await c.req.json();

    if (!name || !email) {
      return c.json({ error: 'Name and email are required' }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    const db = c.env.DB;

    // Check if email is already taken by another user
    if (email !== user.email) {
      const existingUser = await db
        .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
        .bind(email, user.id)
        .first();

      if (existingUser) {
        return c.json({ error: 'Email is already taken' }, 409);
      }
    }

    const now = Math.floor(Date.now() / 1000);

    // Update user profile
    await db
      .prepare('UPDATE users SET name = ?, email = ?, updated_at = ? WHERE id = ?')
      .bind(name, email, now, user.id)
      .run();

    // Get updated user
    const updatedUser = await db
      .prepare('SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ?')
      .bind(user.id)
      .first();

    // Log profile update
    await logAction(
      'user.profile_update',
      {
        resource_type: 'user',
        resource_id: user.id,
        updated_fields: email !== user.email ? ['name', 'email'] : ['name'],
      },
      {
        userId: user.id,
        ipAddress: getIpAddress(c.req.raw),
        userAgent: getUserAgent(c.req.raw),
      },
      c.env
    );

    return c.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PATCH /settings/password
 * Change user password
 */
settings.patch('/password', async (c) => {
  try {
    const user = c.get('user');
    const { currentPassword, newPassword } = await c.req.json();

    if (!currentPassword || !newPassword) {
      return c.json({ error: 'Current password and new password are required' }, 400);
    }

    if (newPassword.length < 8) {
      return c.json({ error: 'New password must be at least 8 characters long' }, 400);
    }

    const db = c.env.DB;

    // Get current user with password hash
    const currentUser = await db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .bind(user.id)
      .first<{ password_hash: string }>();

    if (!currentUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, currentUser.password_hash);
    if (!isValid) {
      return c.json({ error: 'Current password is incorrect' }, 401);
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);
    const now = Math.floor(Date.now() / 1000);

    // Update password
    await db
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .bind(newPasswordHash, now, user.id)
      .run();

    // Log password change
    await logAction(
      'user.password_change',
      {
        resource_type: 'user',
        resource_id: user.id,
      },
      {
        userId: user.id,
        ipAddress: getIpAddress(c.req.raw),
        userAgent: getUserAgent(c.req.raw),
      },
      c.env
    );

    return c.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default settings;

