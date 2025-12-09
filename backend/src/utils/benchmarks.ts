// Benchmark utilities for performance measurement

import { Env } from '../types';
import { logger } from './logger';

interface BenchmarkResult {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface HealthCheckBenchmark {
  serviceId: string;
  checkType: string;
  duration: number;
  success: boolean;
  timestamp: number;
}

interface CronBenchmark {
  cronTime: string;
  duration: number;
  servicesProcessed: number;
  jobsQueued: number;
  timestamp: number;
}

interface QueueBenchmark {
  batchSize: number;
  processingDuration: number;
  successCount: number;
  failureCount: number;
  timestamp: number;
}

/**
 * Measure health check throughput
 */
export async function benchmarkHealthCheck(
  env: Env,
  serviceId: string,
  checkType: string,
  checkFunction: () => Promise<any>
): Promise<HealthCheckBenchmark> {
  const start = Date.now();
  let success = false;

  try {
    await checkFunction();
    success = true;
  } catch (error) {
    logger.error('Health check benchmark failed', error as Error, {
      serviceId,
      checkType,
    });
  }

  const duration = Date.now() - start;

  const benchmark: HealthCheckBenchmark = {
    serviceId,
    checkType,
    duration,
    success,
    timestamp: Math.floor(Date.now() / 1000),
  };

  // Log benchmark result
  logger.debug('Health check benchmark', {
    serviceId,
    checkType,
    duration,
    success,
  });

  return benchmark;
}

/**
 * Measure cron trigger latency
 */
export async function benchmarkCronTrigger(
  env: Env,
  cronTime: string,
  operation: () => Promise<{ servicesProcessed: number; jobsQueued: number }>
): Promise<CronBenchmark> {
  const start = Date.now();

  const result = await operation();

  const duration = Date.now() - start;

  const benchmark: CronBenchmark = {
    cronTime,
    duration,
    servicesProcessed: result.servicesProcessed,
    jobsQueued: result.jobsQueued,
    timestamp: Math.floor(Date.now() / 1000),
  };

  // Log benchmark result
  logger.info('Cron trigger benchmark', {
    cronTime,
    duration,
    servicesProcessed: result.servicesProcessed,
    jobsQueued: result.jobsQueued,
  });

  return benchmark;
}

/**
 * Measure queue processing rate
 */
export async function benchmarkQueueProcessing(
  env: Env,
  batch: any[],
  processFunction: (job: any) => Promise<void>
): Promise<QueueBenchmark> {
  const start = Date.now();
  let successCount = 0;
  let failureCount = 0;

  // Process batch in parallel (up to 10 concurrent)
  const batchSize = Math.min(batch.length, 10);
  const chunks: any[][] = [];

  for (let i = 0; i < batch.length; i += batchSize) {
    chunks.push(batch.slice(i, i + batchSize));
  }

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map((job) => processFunction(job))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        failureCount++;
        logger.warn('Queue job processing failed', {
          error: result.reason?.message,
        });
      }
    }
  }

  const processingDuration = Date.now() - start;

  const benchmark: QueueBenchmark = {
    batchSize: batch.length,
    processingDuration,
    successCount,
    failureCount,
    timestamp: Math.floor(Date.now() / 1000),
  };

  // Log benchmark result
  logger.info('Queue processing benchmark', {
    batchSize: batch.length,
    processingDuration,
    successCount,
    failureCount,
    throughput: (batch.length / (processingDuration / 1000)).toFixed(2) + ' jobs/sec',
  });

  return benchmark;
}

/**
 * Store benchmark results in KV (optional)
 */
export async function storeBenchmarkResult(
  env: Env,
  result: BenchmarkResult
): Promise<void> {
  if (!env.STATUS_SNAPSHOTS) {
    return;
  }

  try {
    const key = `benchmark:${result.name}:${result.timestamp}`;
    await env.STATUS_SNAPSHOTS.put(
      key,
      JSON.stringify(result),
      { expirationTtl: 86400 * 7 } // Keep for 7 days
    );
  } catch (error) {
    logger.warn('Failed to store benchmark result', {
      error: (error as Error).message,
    });
  }
}

/**
 * Get benchmark statistics
 */
export async function getBenchmarkStats(
  env: Env,
  benchmarkName: string,
  hours: number = 24
): Promise<{
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p95Duration: number;
  p99Duration: number;
}> {
  // In a real implementation, this would query stored benchmark results
  // For now, return placeholder stats
  return {
    count: 0,
    avgDuration: 0,
    minDuration: 0,
    maxDuration: 0,
    p95Duration: 0,
    p99Duration: 0,
  };
}

