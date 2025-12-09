// Anomaly detection utilities for monitoring
// Implements statistical methods for detecting anomalies in response times

export type AnomalyType = 'spike' | 'slowdown' | 'unknown';

export interface AnomalyResult {
  anomalyDetected: boolean;
  anomalyType: AnomalyType;
  anomalyScore: number;
  mean: number;
  stdDev: number;
  zScore: number;
}

/**
 * Calculate rolling average (mean) of the last N values
 */
export function calculateRollingAverage(values: number[], windowSize: number): number {
  if (values.length === 0) return 0;
  if (values.length < windowSize) {
    // Use all available values if we don't have enough
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }
  // Use only the last windowSize values
  const window = values.slice(-windowSize);
  const sum = window.reduce((acc, val) => acc + val, 0);
  return sum / window.length;
}

/**
 * Calculate rolling standard deviation
 */
export function calculateRollingStdDev(values: number[], windowSize: number, mean?: number): number {
  if (values.length === 0) return 0;
  if (values.length < windowSize) {
    // Use all available values
    const avg = mean ?? calculateRollingAverage(values, values.length);
    const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
  // Use only the last windowSize values
  const window = values.slice(-windowSize);
  const avg = mean ?? calculateRollingAverage(window, windowSize);
  const variance = window.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / window.length;
  return Math.sqrt(variance);
}

/**
 * Calculate Z-score for a value
 * Z-score = (value - mean) / stdDev
 */
export function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0; // Avoid division by zero
  return (value - mean) / stdDev;
}

/**
 * Detect anomalies in response time data
 * Uses statistical methods: rolling average, std dev, and z-score
 * 
 * @param currentValue - Current response time to check
 * @param historicalValues - Array of historical response times (should be sorted chronologically)
 * @param windowSize - Number of recent values to use for baseline (default: 20)
 * @param threshold - Z-score threshold for anomaly detection (default: 3)
 * @returns AnomalyResult with detection information
 */
export function detectAnomaly(
  currentValue: number,
  historicalValues: number[],
  windowSize: number = 20,
  threshold: number = 3
): AnomalyResult {
  // Need at least 2 values to calculate std dev
  if (historicalValues.length < 2) {
    return {
      anomalyDetected: false,
      anomalyType: 'unknown',
      anomalyScore: 0,
      mean: currentValue,
      stdDev: 0,
      zScore: 0,
    };
  }

  // Calculate rolling statistics
  const mean = calculateRollingAverage(historicalValues, windowSize);
  const stdDev = calculateRollingStdDev(historicalValues, windowSize, mean);
  const zScore = calculateZScore(currentValue, mean, stdDev);

  // Determine if anomaly is detected
  const absZScore = Math.abs(zScore);
  const anomalyDetected = absZScore >= threshold;

  // Determine anomaly type
  let anomalyType: AnomalyType = 'unknown';
  if (anomalyDetected) {
    if (zScore > 0) {
      // Positive z-score means value is higher than average (spike/slowdown)
      // If response time is significantly higher, it's a slowdown
      // If it's extremely high, it's a spike
      anomalyType = currentValue > mean * 2 ? 'spike' : 'slowdown';
    } else {
      // Negative z-score means value is lower than average (faster than normal)
      // This is usually not an anomaly, but we'll mark it as unknown
      anomalyType = 'unknown';
    }
  }

  // Calculate anomaly score (0-100 scale)
  // Higher score = more anomalous
  const anomalyScore = Math.min(100, Math.max(0, (absZScore / threshold) * 100));

  return {
    anomalyDetected,
    anomalyType,
    anomalyScore,
    mean,
    stdDev,
    zScore,
  };
}

/**
 * Detect spike using mean + 3*std method
 * Spike is detected if value > mean + 3*std
 */
export function detectSpike(
  currentValue: number,
  historicalValues: number[],
  windowSize: number = 20
): boolean {
  if (historicalValues.length < 2) return false;

  const mean = calculateRollingAverage(historicalValues, windowSize);
  const stdDev = calculateRollingStdDev(historicalValues, windowSize, mean);
  const threshold = mean + 3 * stdDev;

  return currentValue > threshold;
}

/**
 * Detect slowdown (gradual increase in response time)
 * Slowdown is detected if value > mean + 2*std but < mean + 3*std
 */
export function detectSlowdown(
  currentValue: number,
  historicalValues: number[],
  windowSize: number = 20
): boolean {
  if (historicalValues.length < 2) return false;

  const mean = calculateRollingAverage(historicalValues, windowSize);
  const stdDev = calculateRollingStdDev(historicalValues, windowSize, mean);
  const lowerThreshold = mean + 2 * stdDev;
  const upperThreshold = mean + 3 * stdDev;

  return currentValue > lowerThreshold && currentValue <= upperThreshold;
}

