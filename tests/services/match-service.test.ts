import { describe, it, expect } from "vitest";
import { MatchService } from "../../src/services/match-service.js";

const mockJobs = [
  { jobName: "Java开发", skills: ["Java", "Spring Boot", "MySQL"], brandName: "A公司" },
  { jobName: "Go开发", skills: ["Go", "Docker", "K8s"], brandName: "B公司" },
  { jobName: "全栈", skills: ["TypeScript", "React", "Node.js"], brandName: "C公司" },
];

describe("MatchService", () => {
  const service = new MatchService();

  describe("matchBySkills", () => {
    it("应计算技能匹配度", () => {
      const result = service.matchBySkills(["Java", "MySQL"], mockJobs as any);
      expect(result).toHaveLength(3);
      // Java开发应最高分
      expect(result[0].job.jobName).toBe("Java开发");
      expect(result[0].score).toBeGreaterThan(0);
    });

    it("应按分数降序排列", () => {
      const result = service.matchBySkills(["Java", "MySQL"], mockJobs as any);
      for (let i = 1; i < result.length; i++) {
        expect(result[i].score).toBeLessThanOrEqual(result[i - 1].score);
      }
    });

    it("应识别匹配和缺失技能", () => {
      const result = service.matchBySkills(["Java"], mockJobs as any);
      const javaJob = result.find(r => r.job.jobName === "Java开发")!;
      expect(javaJob.matchedSkills).toContain("Java");
      expect(javaJob.missingSkills.length).toBeGreaterThan(0);
    });

    it("空技能返回零分", () => {
      const result = service.matchBySkills([], mockJobs as any);
      result.forEach(r => expect(r.score).toBe(0));
    });
  });

  describe("matchByProfile", () => {
    it("应使用 profile 的 skills 进行匹配", () => {
      const profile = { skills: ["Java", "Spring Boot"] };
      const result = service.matchByProfile(profile as any, mockJobs as any);
      expect(result[0].job.jobName).toBe("Java开发");
    });
  });
});
