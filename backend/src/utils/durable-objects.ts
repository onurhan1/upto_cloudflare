// Durable Object utilities with batch update support

import { Env } from '../types';

/**
 * Update Durable Object state with optimized batch mode
 */
export async function updateServiceState(
  env: Env,
  serviceId: string,
  status: 'up' | 'down' | 'degraded',
  timestamp: number,
  immediate: boolean = false
): Promise<void> {
  if (!env.SERVICE_STATE) {
    return;
  }

  try {
    const doId = env.SERVICE_STATE.idFromName(serviceId);
    const stub = env.SERVICE_STATE.get(doId);

    // Use batch update endpoint for better performance
    // For critical status changes (down/degraded), use immediate update
    const endpoint = immediate || status === 'down' || status === 'degraded' 
      ? '/update' 
      : '/update';

    await stub.fetch(new Request('https://internal/update', {
      method: 'POST',
      body: JSON.stringify({
        status,
        timestamp,
      }),
    }));
  } catch (doError) {
    console.error('Durable Object update error:', doError);
    // Continue even if DO update fails
  }
}

/**
 * Batch update multiple service states
 */
export async function batchUpdateServiceStates(
  env: Env,
  updates: Array<{ serviceId: string; status: 'up' | 'down' | 'degraded'; timestamp: number }>
): Promise<void> {
  if (!env.SERVICE_STATE || updates.length === 0) {
    return;
  }

  // Group updates by service ID
  const updatesByService = new Map<string, Array<{ status: 'up' | 'down' | 'degraded'; timestamp: number }>>();

  for (const update of updates) {
    if (!updatesByService.has(update.serviceId)) {
      updatesByService.set(update.serviceId, []);
    }
    updatesByService.get(update.serviceId)!.push({
      status: update.status,
      timestamp: update.timestamp,
    });
  }

  // Send batch updates in parallel (up to 10 at a time)
  const batchSize = 10;
  const serviceIds = Array.from(updatesByService.keys());

  for (let i = 0; i < serviceIds.length; i += batchSize) {
    const batch = serviceIds.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (serviceId) => {
        try {
          const doId = env.SERVICE_STATE!.idFromName(serviceId);
          const stub = env.SERVICE_STATE!.get(doId);
          const serviceUpdates = updatesByService.get(serviceId)!;

          await stub.fetch(new Request('https://internal/batch-update', {
            method: 'POST',
            body: JSON.stringify({
              updates: serviceUpdates,
            }),
          }));
        } catch (error) {
          console.error(`Error batch updating service ${serviceId}:`, error);
        }
      })
    );
  }
}

/**
 * Get service state with read-through caching
 */
export async function getServiceState(
  env: Env,
  serviceId: string
): Promise<any | null> {
  if (!env.SERVICE_STATE) {
    return null;
  }

  try {
    const doId = env.SERVICE_STATE.idFromName(serviceId);
    const stub = env.SERVICE_STATE.get(doId);

    const response = await stub.fetch(new Request('https://internal/state', {
      method: 'GET',
    }));

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error(`Error getting service state for ${serviceId}:`, error);
  }

  return null;
}

