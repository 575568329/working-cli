import { describe, it, expect } from "vitest";
import {
  gaussianRandom,
  calculateBurstPenalty,
  calculateRateLimitBackoff,
  calculateRequestDelay,
} from "../../src/utils/delay.js";

describe("gaussianRandom", () => {
  it("应在合理范围内（3σ）", () => {
    for (let i = 0; i < 200; i++) {
      const val = gaussianRandom(1.0, 0.3);
      expect(val).toBeGreaterThan(-0.5);
      expect(val).toBeLessThan(2.5);
    }
  });

  it("均值应接近 1.0", () => {
    const samples = Array.from({ length: 1000 }, () => gaussianRandom(1.0, 0.3));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(mean).toBeGreaterThan(0.9);
    expect(mean).toBeLessThan(1.1);
  });
});

describe("calculateBurstPenalty", () => {
  it("无请求时返回 0", () => {
    expect(calculateBurstPenalty([])).toBe(0);
  });

  it("15s 内 3 次请求应有惩罚", () => {
    const now = Date.now();
    const recent = [now - 5000, now - 3000, now - 1000];
    const penalty = calculateBurstPenalty(recent);
    expect(penalty).toBeGreaterThan(0);
  });

  it("分散的请求不应有惩罚", () => {
    const now = Date.now();
    const spread = [now - 30000, now - 60000];
    expect(calculateBurstPenalty(spread)).toBe(0);
  });
});

describe("calculateRateLimitBackoff", () => {
  it("第一次应退避 10s", () => {
    expect(calculateRateLimitBackoff(1)).toBe(10_000);
  });

  it("应指数增长", () => {
    expect(calculateRateLimitBackoff(2)).toBe(20_000);
    expect(calculateRateLimitBackoff(3)).toBe(40_000);
  });

  it("上限应为 60s", () => {
    expect(calculateRateLimitBackoff(10)).toBe(60_000);
  });
});

describe("calculateRequestDelay", () => {
  it("应大于基础延迟", () => {
    const delay = calculateRequestDelay(1000);
    expect(delay).toBeGreaterThanOrEqual(1000);
  });
});
