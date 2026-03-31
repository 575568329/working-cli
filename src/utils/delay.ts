/**
 * Box-Muller 变换生成高斯随机数
 */
export function gaussianRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Promise 延时
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 计算突发惩罚延迟
 * 15s 内 >=3 次请求 → 额外延迟 1.2-2.8s
 * 45s 内 >=6 次请求 → 额外延迟 4.0-7.0s
 */
export function calculateBurstPenalty(recentRequestTimes: number[]): number {
  if (recentRequestTimes.length === 0) return 0;

  const now = Date.now();
  const recent15s = recentRequestTimes.filter((ts) => now - ts <= 15_000).length;
  const recent45s = recentRequestTimes.filter((ts) => now - ts <= 45_000).length;

  if (recent45s >= 6) {
    return uniformRandom(4.0, 7.0) * 1000; // ms
  }
  if (recent15s >= 3) {
    return uniformRandom(1.2, 2.8) * 1000; // ms
  }
  return 0;
}

/**
 * 计算限流退避时间（指数退避）
 * 10s → 20s → 40s → 60s（上限）
 */
export function calculateRateLimitBackoff(count: number): number {
  return Math.min(60_000, 10_000 * Math.pow(2, count - 1));
}

/**
 * 生成请求延迟时间（高斯 + 5% 长停顿）
 * @returns 延迟毫秒数
 */
export function calculateRequestDelay(baseDelayMs: number): number {
  const jitter = Math.max(0, gaussianRandom(300, 150)); // ms
  let delay = baseDelayMs + jitter;

  // 5% 概率长停顿，模拟阅读
  if (Math.random() < 0.05) {
    delay += uniformRandom(2000, 5000);
  }

  return delay;
}

function uniformRandom(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
