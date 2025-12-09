// KV Cache utilities with optimized write frequency and invalidation strategy

import { Env } from '../types';

interface ServiceSnapshot {
  status: 'up' | 'down' | 'degraded';
  responseTime: number | null;
  statusCode: number | null;
  lastCheck: number;
  errorMessage: string | null;
  lastWritten?: number; // Track when snapshot was last written
}

/**
 * Write service snapshot to KV with throttling
 * Only writes if status changed or if last write was more than 5 minutes ago
 */
export async function writeServiceSnapshot(
  env: Env,
  serviceId: string,
  snapshot: Omit<ServiceSnapshot, 'lastWritten'>
): Promise<void> {
  if (!env.STATUS_SNAPSHOTS) {
    return;
  }

  try {
    // Read existing snapshot to check if we need to update
    const existing = await env.STATUS_SNAPSHOTS.get(`service:${serviceId}`, 'json') as ServiceSnapshot | null;
    
    const now = Math.floor(Date.now() / 1000);
    const shouldWrite = 
      !existing || // No existing snapshot
      existing.status !== snapshot.status || // Status changed
      existing.responseTime !== snapshot.responseTime || // Response time changed significantly
      (existing.lastWritten && (now - existing.lastWritten) > 300) || // Last write was > 5 minutes ago
      (snapshot.status === 'down' || snapshot.status === 'degraded'); // Always write down/degraded status

    if (shouldWrite) {
      const snapshotWithTimestamp: ServiceSnapshot = {
        ...snapshot,
        lastWritten: now,
      };

      await env.STATUS_SNAPSHOTS.put(
        `service:${serviceId}`,
        JSON.stringify(snapshotWithTimestamp),
        { expirationTtl: 86400 } // 24 hours
      );
    }
  } catch (error) {
    console.error(`Error writing service snapshot for ${serviceId}:`, error);
    // Don't throw - KV writes are non-critical
  }
}

/**
 * Read service snapshot from KV with fallback
 */
export async function readServiceSnapshot(
  env: Env,
  serviceId: string
): Promise<ServiceSnapshot | null> {
  if (!env.STATUS_SNAPSHOTS) {
    return null;
  }

  try {
    const snapshot = await env.STATUS_SNAPSHOTS.get(`service:${serviceId}`, 'json') as ServiceSnapshot | null;
    return snapshot;
  } catch (error) {
    console.error(`Error reading service snapshot for ${serviceId}:`, error);
    return null;
  }
}

/**
 * Invalidate service snapshot (delete from cache)
 */
export async function invalidateServiceSnapshot(
  env: Env,
  serviceId: string
): Promise<void> {
  if (!env.STATUS_SNAPSHOTS) {
    return;
  }

  try {
    await env.STATUS_SNAPSHOTS.delete(`service:${serviceId}`);
  } catch (error) {
    console.error(`Error invalidating service snapshot for ${serviceId}:`, error);
  }
}

/**
 * Batch invalidate multiple service snapshots
 */
export async function batchInvalidateServiceSnapshots(
  env: Env,
  serviceIds: string[]
): Promise<void> {
  if (!env.STATUS_SNAPSHOTS || serviceIds.length === 0) {
    return;
  }

  // Delete in parallel (up to 10 at a time to avoid rate limits)
  const batchSize = 10;
  for (let i = 0; i < serviceIds.length; i += batchSize) {
    const batch = serviceIds.slice(i, i + batchSize);
    await Promise.all(
      batch.map((serviceId) => invalidateServiceSnapshot(env, serviceId))
    );
  }
}

/**
 * Status page cache utilities
 */
export async function writeStatusPageCache(
  env: Env,
  slug: string,
  data: any,
  ttl: number = 300 // Default 5 minutes
): Promise<void> {
  if (!env.STATUS_PAGE_CACHE) {
    return;
  }

  try {
    await env.STATUS_PAGE_CACHE.put(
      `status_page:${slug}`,
      JSON.stringify({
        ...data,
        cached_at: Math.floor(Date.now() / 1000),
      }),
      { expirationTtl: ttl }
    );
  } catch (error) {
    console.error(`Error writing status page cache for ${slug}:`, error);
  }
}

export async function readStatusPageCache(
  env: Env,
  slug: string
): Promise<any | null> {
  if (!env.STATUS_PAGE_CACHE) {
    return null;
  }

  try {
    const cached = await env.STATUS_PAGE_CACHE.get(`status_page:${slug}`, 'json');
    return cached;
  } catch (error) {
    console.error(`Error reading status page cache for ${slug}:`, error);
    return null;
  }
}

export async function invalidateStatusPageCache(
  env: Env,
  slug: string
): Promise<void> {
  if (!env.STATUS_PAGE_CACHE) {
    return;
  }

  try {
    await env.STATUS_PAGE_CACHE.delete(`status_page:${slug}`);
  } catch (error) {
    console.error(`Error invalidating status page cache for ${slug}:`, error);
  }
}

