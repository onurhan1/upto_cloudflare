// UUID v4 generator for Cloudflare Workers
// Simple implementation using crypto.randomUUID if available, otherwise fallback

export function generateUUID(): string {
  // Use native crypto.randomUUID if available (Cloudflare Workers supports it)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

