import { describe, it, expect } from "vitest";
import { parseSalaryRange, truncate, formatPercentage } from "../../src/utils/format.js";

describe("parseSalaryRange", () => {
  it("应解析 K 范围", () => {
    expect(parseSalaryRange("20-30K")).toEqual({ min: 20000, max: 30000 });
    expect(parseSalaryRange("5-10K")).toEqual({ min: 5000, max: 10000 });
    expect(parseSalaryRange("3-5K")).toEqual({ min: 3000, max: 5000 });
  });

  it("应解析 'XX以上'", () => {
    expect(parseSalaryRange("50K以上")).toEqual({ min: 50000, max: Infinity });
  });

  it("应解析 'XX以下'", () => {
    expect(parseSalaryRange("3K以下")).toEqual({ min: 0, max: 3000 });
  });

  it("无法解析时返回 0,0", () => {
    expect(parseSalaryRange("面议")).toEqual({ min: 0, max: 0 });
  });
});

describe("truncate", () => {
  it("短字符串不变", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("长字符串应截断", () => {
    expect(truncate("hello world", 6)).toBe("hello…");
  });
});

describe("formatPercentage", () => {
  it("应格式化百分比", () => {
    expect(formatPercentage(3, 10)).toBe("30%");
    expect(formatPercentage(1, 3)).toBe("33%");
  });

  it("总数为 0 时返回 0%", () => {
    expect(formatPercentage(0, 0)).toBe("0%");
  });
});
