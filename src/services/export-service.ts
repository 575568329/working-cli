import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { Job } from "../client/types.js";

export class ExportService {
  exportCSV(jobs: Job[], filePath: string): void {
    const headers = [
      "职位名称", "公司", "城市", "薪资", "规模", "行业",
      "融资阶段", "经验要求", "学历要求", "技能", "BOSS"
    ];

    const rows = jobs.map(job => [
      job.jobName,
      job.brandName,
      job.cityName,
      job.salaryDesc,
      job.companySize,
      job.industry,
      job.financeStage,
      job.experience ?? "",
      job.degree ?? "",
      job.skills.join(","),
      `${job.bossName}(${job.bossTitle})`,
    ].map(field => {
      // CSV 中含逗号或引号的字段需要用双引号包裹
      const str = String(field);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }));

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, "\uFEFF" + csv, "utf-8"); // BOM for Excel
  }

  exportJSON(jobs: Job[], filePath: string): void {
    const data = {
      ok: true,
      schema_version: "1",
      exportedAt: new Date().toISOString(),
      count: jobs.length,
      data: jobs,
    };
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  }
}
