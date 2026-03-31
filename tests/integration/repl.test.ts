import { describe, it, expect, beforeEach } from "vitest";
import { parseCommand } from "../../src/commands/router.js";
import { SharedContext } from "../../src/repl/context.js";
import { AnalyzeService } from "../../src/services/analyze-service.js";
import { MatchService } from "../../src/services/match-service.js";
import { ExportService } from "../../src/services/export-service.js";
import { renderJobTable, renderSalaryAnalysis, renderSkillsAnalysis, renderMatchResults } from "../../src/repl/renderer.js";
import { existsSync, rmSync, readFileSync } from "fs";
import path from "path";
import os from "os";
import type { Job } from "../../src/client/types.js";

// Mock 数据
const mockJobs: Job[] = [
  {
    jobName: "高级Java开发工程师",
    salaryDesc: "30-50K",
    cityName: "杭州",
    brandName: "阿里巴巴",
    companySize: "10000人以上",
    industry: "互联网",
    financeStage: "已上市",
    skills: ["Java", "Spring Boot", "MySQL", "Redis"],
    experience: "3-5年",
    degree: "本科",
    securityId: "sec-1",
    bossName: "张三",
    bossTitle: "技术总监",
    jobType: 0,
    jobLabels: [],
    lid: "lid-1",
  },
  {
    jobName: "Java后端开发",
    salaryDesc: "25-40K",
    cityName: "杭州",
    brandName: "网易",
    companySize: "10000人以上",
    industry: "互联网",
    financeStage: "已上市",
    skills: ["Java", "Spring", "MySQL"],
    experience: "1-3年",
    degree: "本科",
    securityId: "sec-2",
    bossName: "李四",
    bossTitle: "技术经理",
    jobType: 0,
    jobLabels: [],
    lid: "lid-2",
  },
  {
    jobName: "Python开发工程师",
    salaryDesc: "20-30K",
    cityName: "上海",
    brandName: "美团",
    companySize: "10000人以上",
    industry: "互联网",
    financeStage: "已上市",
    skills: ["Python", "Django", "Redis"],
    experience: "1-3年",
    degree: "本科",
    securityId: "sec-3",
    bossName: "王五",
    bossTitle: "技术主管",
    jobType: 0,
    jobLabels: [],
    lid: "lid-3",
  },
];

describe("集成测试：完整 REPL 流程", () => {
  let context: SharedContext;
  let analyzeService: AnalyzeService;
  let matchService: MatchService;
  let exportService: ExportService;

  beforeEach(() => {
    context = new SharedContext();
    analyzeService = new AnalyzeService();
    matchService = new MatchService();
    exportService = new ExportService();
  });

  it("Step 1: 解析搜索命令", () => {
    const cmd = parseCommand("/search Java --city 杭州 --salary 20-30K");
    expect(cmd.name).toBe("search");
    expect(cmd.args).toEqual(["Java"]);
    expect(cmd.flags.city).toBe("杭州");
    expect(cmd.flags.salary).toBe("20-30K");
  });

  it("Step 2: 模拟搜索并存储结果", () => {
    context.setCurrentJobs([...mockJobs]);
    expect(context.getCurrentJobs()).toHaveLength(3);
    expect(context.getJobByIndex(1)?.jobName).toBe("高级Java开发工程师");
  });

  it("Step 3: 分析薪资", () => {
    context.setCurrentJobs([...mockJobs]);
    const salary = analyzeService.analyzeSalary(context.getCurrentJobs());
    expect(salary.average).toBeGreaterThan(0);
    expect(salary.distribution.length).toBeGreaterThan(0);

    context.setSalaryAnalysis(salary);
    expect(context.getSalaryAnalysis()?.average).toBeGreaterThan(0);

    // 渲染不抛错
    const rendered = renderSalaryAnalysis(salary);
    expect(rendered).toContain("薪资分析");
  });

  it("Step 4: 分析技能", () => {
    context.setCurrentJobs([...mockJobs]);
    const skills = analyzeService.analyzeSkills(context.getCurrentJobs());
    expect(skills.length).toBeGreaterThan(0);

    // Java 应排第一（出现2次，Redis 出现2次，并列第一）
    const javaSkill = skills.find(s => s.name === "Java");
    expect(javaSkill).toBeDefined();
    expect(javaSkill!.count).toBeGreaterThanOrEqual(2);

    // 渲染不抛错
    const rendered = renderSkillsAnalysis(skills);
    expect(rendered).toContain("技能需求");
  });

  it("Step 5: 匹配岗位", () => {
    context.setCurrentJobs([...mockJobs]);
    const results = matchService.matchBySkills(["Java", "MySQL"], context.getCurrentJobs());
    // 3 个岗位都会返回，按 score 降序排列
    expect(results).toHaveLength(3);
    expect(results[0].score).toBeGreaterThan(0);

    // 第一个结果 score 最高，应该是包含 Java + MySQL 最多的岗位
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);

    context.setMatchResults(results);
    expect(context.getMatchResults()).toHaveLength(3);

    // 渲染不抛错
    const rendered = renderMatchResults(results);
    expect(rendered).toContain("匹配");
  });

  it("Step 6: 导出 CSV", () => {
    const outDir = path.join(os.tmpdir(), "boss-agent-integration-test");
    const csvPath = path.join(outDir, "test.csv");

    context.setCurrentJobs([...mockJobs]);
    exportService.exportCSV(context.getCurrentJobs(), csvPath);

    expect(existsSync(csvPath)).toBe(true);
    const content = readFileSync(csvPath, "utf-8");
    expect(content).toContain("Java");
    expect(content).toContain("阿里巴巴");

    rmSync(outDir, { recursive: true, force: true });
  });

  it("Step 7: 导出 JSON", () => {
    const outDir = path.join(os.tmpdir(), "boss-agent-integration-test");
    const jsonPath = path.join(outDir, "test.json");

    context.setCurrentJobs([...mockJobs]);
    exportService.exportJSON(context.getCurrentJobs(), jsonPath);

    expect(existsSync(jsonPath)).toBe(true);
    const data = JSON.parse(readFileSync(jsonPath, "utf-8"));
    expect(data.ok).toBe(true);
    expect(data.data).toHaveLength(3);

    rmSync(outDir, { recursive: true, force: true });
  });

  it("Step 8: 清空上下文", () => {
    context.setCurrentJobs([...mockJobs]);
    context.clear();
    expect(context.getCurrentJobs()).toEqual([]);
  });

  it("Step 9: 渲染职位表格", () => {
    context.setCurrentJobs([...mockJobs]);
    const rendered = renderJobTable(context.getCurrentJobs());
    expect(rendered).toContain("高级Java开发工程师");
    expect(rendered).toContain("阿里巴巴");
  });

  it("Step 10: 渲染空结果", () => {
    const rendered = renderJobTable([]);
    expect(rendered).toContain("没有搜索结果");
  });
});
