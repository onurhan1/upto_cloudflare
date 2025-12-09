// Durable Object for tracking service state and flapping detection
// Optimized with batch update mode and read-through caching

interface ServiceState {
  serviceId: string;
  currentStatus: 'up' | 'down' | 'degraded';
  recentChecks: Array<{
    timestamp: number;
    status: 'up' | 'down' | 'degraded';
  }>;
  openIncidentId: string | null;
  lastCheckAt: number;
  cachedAt?: number; // For read-through caching
}

export class ServiceStateObject {
  private state: DurableObjectState;
  private env: any;
  private pendingUpdates: Array<{ status: 'up' | 'down' | 'degraded'; timestamp: number }> = [];
  private batchUpdateTimer: number | null = null;
  private readonly BATCH_WINDOW_MS = 1000; // 1 second batch window
  private readonly CACHE_TTL = 60; // Cache for 60 seconds

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/update' && request.method === 'POST') {
      return this.handleUpdate(request);
    }

    if (url.pathname === '/batch-update' && request.method === 'POST') {
      return this.handleBatchUpdate(request);
    }

    if (url.pathname === '/state' && request.method === 'GET') {
      return this.handleGetState();
    }

    if (url.pathname === '/check-flapping' && request.method === 'GET') {
      return this.handleCheckFlapping();
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Update service state with new check result (single update)
   * Uses batch mode for better performance
   */
  private async handleUpdate(request: Request): Promise<Response> {
    const body = await request.json<{
      status: 'up' | 'down' | 'degraded';
      timestamp: number;
    }>();

    // Add to pending batch
    this.pendingUpdates.push({
      status: body.status,
      timestamp: body.timestamp,
    });

    // Schedule batch update if not already scheduled
    if (this.batchUpdateTimer === null) {
      this.batchUpdateTimer = setTimeout(() => {
        this.flushBatchUpdates();
      }, this.BATCH_WINDOW_MS) as unknown as number;
    }

    // For critical status changes (down/degraded), flush immediately
    if (body.status === 'down' || body.status === 'degraded') {
      await this.flushBatchUpdates();
    }

    return new Response(JSON.stringify({ success: true, batched: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Batch update multiple check results at once
   */
  private async handleBatchUpdate(request: Request): Promise<Response> {
    const body = await request.json<{
      updates: Array<{ status: 'up' | 'down' | 'degraded'; timestamp: number }>;
    }>();

    await this.applyUpdates(body.updates);

    return new Response(JSON.stringify({ success: true, count: body.updates.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Flush pending batch updates
   */
  private async flushBatchUpdates(): Promise<void> {
    if (this.pendingUpdates.length === 0) {
      return;
    }

    const updates = [...this.pendingUpdates];
    this.pendingUpdates = [];
    this.batchUpdateTimer = null;

    await this.applyUpdates(updates);
  }

  /**
   * Apply updates to state
   */
  private async applyUpdates(
    updates: Array<{ status: 'up' | 'down' | 'degraded'; timestamp: number }>
  ): Promise<void> {
    // Load state from storage (with read-through cache check)
    let state: ServiceState = await this.loadStateWithCache();

    // Sort updates by timestamp
    updates.sort((a, b) => a.timestamp - b.timestamp);

    // Apply all updates
    for (const update of updates) {
      // Add to recent checks (keep last 20)
      state.recentChecks.push({
        timestamp: update.timestamp,
        status: update.status,
      });

      if (state.recentChecks.length > 20) {
        state.recentChecks.shift();
      }

      // Update current status (use latest)
      state.currentStatus = update.status;
      state.lastCheckAt = update.timestamp;
    }

    // Save to storage
    state.cachedAt = Math.floor(Date.now() / 1000);
    await this.state.storage.put('state', state);
  }

  /**
   * Load state with read-through caching
   * Checks KV cache first, then falls back to DO storage
   */
  private async loadStateWithCache(): Promise<ServiceState> {
    const now = Math.floor(Date.now() / 1000);
    const serviceId = this.state.id.toString();

    // Try to read from KV cache first (read-through)
    if (this.env?.STATUS_SNAPSHOTS) {
      try {
        const cached = await this.env.STATUS_SNAPSHOTS.get(`do_state:${serviceId}`, 'json') as ServiceState | null;
        if (cached && cached.cachedAt && (now - cached.cachedAt) < this.CACHE_TTL) {
          // Cache hit - return cached state
          return cached;
        }
      } catch (error) {
        // Cache miss or error - continue to storage
      }
    }

    // Cache miss - load from DO storage
    const state: ServiceState = await this.state.storage.get<ServiceState>('state') || {
      serviceId: '',
      currentStatus: 'up',
      recentChecks: [],
      openIncidentId: null,
      lastCheckAt: 0,
    };

    // Write to KV cache for future reads (write-through)
    if (this.env?.STATUS_SNAPSHOTS) {
      try {
        const cachedState = { ...state, cachedAt: now };
        await this.env.STATUS_SNAPSHOTS.put(
          `do_state:${serviceId}`,
          JSON.stringify(cachedState),
          { expirationTtl: this.CACHE_TTL }
        );
      } catch (error) {
        // Cache write failed - continue anyway
      }
    }

    return state;
  }

  /**
   * Get current state (with read-through caching)
   */
  private async handleGetState(): Promise<Response> {
    const state = await this.loadStateWithCache();

    // Remove cache metadata from response
    const { cachedAt, ...responseState } = state;

    return new Response(JSON.stringify(responseState), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Check if service is flapping (rapid state changes)
   * Returns true if service changed state more than 3 times in the last 5 minutes
   * Uses read-through caching
   */
  private async handleCheckFlapping(): Promise<Response> {
    const state = await this.loadStateWithCache();

    const now = Math.floor(Date.now() / 1000);
    const fiveMinutesAgo = now - 300;

    // Filter checks from last 5 minutes
    const recentChecks = state.recentChecks.filter(
      (check) => check.timestamp >= fiveMinutesAgo
    );

    if (recentChecks.length < 4) {
      return new Response(JSON.stringify({ isFlapping: false }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Count state changes
    let stateChanges = 0;
    for (let i = 1; i < recentChecks.length; i++) {
      if (recentChecks[i].status !== recentChecks[i - 1].status) {
        stateChanges++;
      }
    }

    const isFlapping = stateChanges >= 3;

    return new Response(JSON.stringify({ isFlapping, stateChanges }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

