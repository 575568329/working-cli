/**
 * Box-Muller transform for Gaussian random number generation
 */
export function gaussianRandom(mean: number, stdDev: number): number {
  const u1 = Math.max(1e-10, Math.random());
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(Math.max(1e-10, u1))) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Promise delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate burst penalty delay
 * >=3 requests within 15s -> extra delay 1.2-2.8s
 * >=6 requests within 45s -> extra delay 4.0-7.0s
 */
export function calculateBurstPenalty(recentRequestTimes: number[]): number {
  if (recentRequestTimes.length === 0) return 0;

  const now = Date.now();
  const recent15s = recentRequestTimes.filter((ts) => now - ts <= 15_000).length;
  const recent45s = recentRequestTimes.filter((ts) => now - ts <= 45_000).length;

  if (recent45s >= 6) {
    return uniformRandom(4.0, 7.0) * 1000;
  }
  if (recent15s >= 3) {
    return uniformRandom(1.2, 2.8) * 1000;
  }
  return 0;
}

/**
 * Calculate rate limit backoff (exponential)
 * 10s -> 20s -> 40s -> 60s (cap)
 */
export function calculateRateLimitBackoff(count: number): number {
  return Math.min(60_000, 10_000 * Math.pow(2, count - 1));
}

/**
 * Generate request delay (Gaussian + 5% long pause)
 * @returns delay in milliseconds
 */
export function calculateRequestDelay(baseDelayMs: number): number {
  const jitter = Math.max(0, gaussianRandom(300, 150));
  let delay = baseDelayMs + jitter;

  // 5% chance of long pause, simulating reading
  if (Math.random() < 0.05) {
    delay += uniformRandom(2000, 5000);
  }

  return delay;
}

function uniformRandom(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
