import { describe, it, expect } from "vitest";
import { SharedContext } from "../../src/repl/context.js";

describe("SharedContext", () => {
  it("应存储和获取搜索结果", () => {
    const ctx = new SharedContext();
    const jobs = [{ jobName: "Java开发", salaryDesc: "20-30K" }];
    ctx.setCurrentJobs(jobs as any);
    expect(ctx.getCurrentJobs()).toHaveLength(1);
  });

  it("应支持通过编号获取", () => {
    const ctx = new SharedContext();
    ctx.setCurrentJobs([{ jobName: "A" }, { jobName: "B" }] as any);
    expect(ctx.getJobByIndex(1)?.jobName).toBe("A");
    expect(ctx.getJobByIndex(2)?.jobName).toBe("B");
    expect(ctx.getJobByIndex(3)).toBeUndefined();
    expect(ctx.getJobByIndex(0)).toBeUndefined();
  });

  it("应存储分析结果", () => {
    const ctx = new SharedContext();
    const salary = { average: 25000, median: 22000, min: 15000, max: 50000, distribution: [] };
    ctx.setSalaryAnalysis(salary as any);
    expect(ctx.getSalaryAnalysis()?.average).toBe(25000);
  });

  it("应存储匹配结果", () => {
    const ctx = new SharedContext();
    ctx.setMatchResults([{ score: 80 } as any]);
    expect(ctx.getMatchResults()).toHaveLength(1);
  });

  it("应存储用户画像", () => {
    const ctx = new SharedContext();
    ctx.setUserProfile({ skills: ["Java"] });
    expect(ctx.getUserProfile().skills).toEqual(["Java"]);
  });

  it("clear 应清空所有数据", () => {
    const ctx = new SharedContext();
    ctx.setCurrentJobs([{ jobName: "A" }] as any);
    ctx.setMatchResults([{ score: 80 } as any]);
    ctx.clear();
    expect(ctx.getCurrentJobs()).toEqual([]);
    expect(ctx.getMatchResults()).toEqual([]);
  });
});
