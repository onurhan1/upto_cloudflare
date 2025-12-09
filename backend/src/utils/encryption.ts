// Encryption utilities for API keys
// Uses Web Crypto API (AES-GCM) for secure encryption/decryption

/**
 * Generate a random encryption key (for first-time setup)
 * This should be run once and stored as an environment variable
 */
export async function generateEncryptionKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );

  const exported = await crypto.subtle.exportKey('raw', key);
  const keyArray = new Uint8Array(exported);
  // Convert to base64 using btoa (available in Workers)
  return btoa(String.fromCharCode(...keyArray));
}

/**
 * Get encryption key from environment or use a default one
 * In production, ENCRYPTION_KEY should be set as an environment variable
 */
function getEncryptionKey(env?: { ENCRYPTION_KEY?: string }): string {
  // In production, use environment variable
  // For local dev, we'll use a default key (not secure, but fine for dev)
  if (env?.ENCRYPTION_KEY) {
    return env.ENCRYPTION_KEY;
  }
  // Default key for local development (32 bytes = 256 bits)
  // In production, this should NEVER be used
  return 'default-dev-key-change-in-production-32chars!!';
}

/**
 * Convert base64 string to ArrayBuffer for Web Crypto API
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Convert base64 string to CryptoKey
 */
async function importKey(keyString: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(keyString);
  return crypto.subtle.importKey(
    'raw',
    keyBuffer,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a string using AES-GCM
 */
export async function encrypt(plaintext: string, env?: { ENCRYPTION_KEY?: string }): Promise<string> {
  try {
    const keyString = getEncryptionKey(env);
    const key = await importKey(keyString);

    // Generate a random IV (12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encodedText = new TextEncoder().encode(plaintext);
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encodedText
    );

    // Combine IV and encrypted data, then base64 encode
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    return arrayBufferToBase64(combined.buffer);
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt a string using AES-GCM
 */
export async function decrypt(ciphertext: string, env?: { ENCRYPTION_KEY?: string }): Promise<string> {
  try {
    const keyString = getEncryptionKey(env);
    const key = await importKey(keyString);

    // Decode base64
    const combinedBuffer = base64ToArrayBuffer(ciphertext);
    const combined = new Uint8Array(combinedBuffer);
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}


