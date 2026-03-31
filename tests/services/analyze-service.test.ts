import { describe, it, expect } from "vitest";
import { AnalyzeService } from "../../src/services/analyze-service.js";

const mockJobs = [
  { salaryDesc: "20-30K", skills: ["Java", "Spring"] },
  { salaryDesc: "30-50K", skills: ["Java", "Redis", "Go"] },
  { salaryDesc: "25-40K", skills: ["Java", "Spring", "MySQL"] },
  { salaryDesc: "15-25K", skills: ["Python", "Django"] },
  { salaryDesc: "40-60K", skills: ["Java", "Spring", "Redis", "MySQL"] },
];

describe("AnalyzeService", () => {
  const service = new AnalyzeService();

  describe("analyzeSalary", () => {
    it("应计算薪资统计", () => {
      const result = service.analyzeSalary(mockJobs as any);
      expect(result.average).toBeGreaterThan(0);
      expect(result.median).toBeGreaterThan(0);
      expect(result.min).toBeGreaterThan(0);
      expect(result.max).toBeGreaterThan(0);
      expect(result.distribution.length).toBeGreaterThan(0);
    });

    it("空列表返回零值", () => {
      const result = service.analyzeSalary([]);
      expect(result.average).toBe(0);
      expect(result.median).toBe(0);
      expect(result.distribution).toEqual([]);
    });

    it("应计算分布", () => {
      const result = service.analyzeSalary(mockJobs as any);
      const totalPercentage = result.distribution.reduce((sum, d) => sum + d.count, 0);
      expect(totalPercentage).toBe(mockJobs.length);
    });
  });

  describe("analyzeSkills", () => {
    it("应统计技能需求", () => {
      const result = service.analyzeSkills(mockJobs as any);
      expect(result[0].name).toBe("Java");
      expect(result[0].count).toBe(4);
    });

    it("应按频率降序排列", () => {
      const result = service.analyzeSkills(mockJobs as any);
      for (let i = 1; i < result.length; i++) {
        expect(result[i].count).toBeLessThanOrEqual(result[i - 1].count);
      }
    });

    it("应计算百分比", () => {
      const result = service.analyzeSkills(mockJobs as any);
      expect(result[0].percentage).toBe(80); // 4/5 = 80%
    });

    it("空列表返回空数组", () => {
      const result = service.analyzeSkills([]);
      expect(result).toEqual([]);
    });
  });
});
