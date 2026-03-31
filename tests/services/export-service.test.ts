import { describe, it, expect, afterEach } from "vitest";
import { ExportService } from "../../src/services/export-service.js";
import { existsSync, rmSync, readFileSync } from "fs";
import path from "path";
import os from "os";

const mockJobs = [
  {
    jobName: "Java开发", brandName: "阿里巴巴", cityName: "杭州",
    salaryDesc: "30-50K", companySize: "10000人以上", industry: "互联网",
    financeStage: "已上市", experience: "3-5年", degree: "本科",
    skills: ["Java", "Spring Boot"], bossName: "张三", bossTitle: "技术总监",
  },
];

const OUT_DIR = path.join(os.tmpdir(), "boss-agent-export-test");

describe("ExportService", () => {
  const service = new ExportService();

  afterEach(() => {
    if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  });

  it("应导出 CSV 文件", () => {
    const csvPath = path.join(OUT_DIR, "test.csv");
    service.exportCSV(mockJobs as any, csvPath);
    expect(existsSync(csvPath)).toBe(true);

    const content = readFileSync(csvPath, "utf-8");
    expect(content.startsWith("\uFEFF")).toBe(true); // BOM
    expect(content).toContain("Java开发");
    expect(content).toContain("阿里巴巴");
  });

  it("应导出 JSON 文件", () => {
    const jsonPath = path.join(OUT_DIR, "test.json");
    service.exportJSON(mockJobs as any, jsonPath);
    expect(existsSync(jsonPath)).toBe(true);

    const data = JSON.parse(readFileSync(jsonPath, "utf-8"));
    expect(data.ok).toBe(true);
    expect(data.schema_version).toBe("1");
    expect(data.count).toBe(1);
    expect(data.data).toHaveLength(1);
  });
});
