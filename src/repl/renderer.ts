import type { Job, SalaryAnalysis, SkillAnalysisItem, MatchResult } from "../client/types.js";
import chalk from "chalk";
import Table from "cli-table3";
import { truncate } from "../utils/format";


/**
 * 渲染职位列表表格
 */
export function renderJobTable(jobs: Job[]): string {
  if (jobs.length === 0) return chalk.yellow("没有搜索结果");

  const table = new Table({
    head: [
      chalk.cyan("#"),
      chalk.cyan("职位名称"),
      chalk.cyan("公司"),
      chalk.cyan("薪资"),
      chalk.cyan("城市"),
      chalk.cyan("规模"),
    ],
    colWidths: [4, 22, 16, 14, 10, 14],
    style: { "padding-left": 1, "padding-right": 1 },
  });

  jobs.forEach((job, i) => {
    table.push([
      String(i + 1),
      truncate(job.jobName, 20),
      truncate(job.brandName, 15),
      chalk.green(job.salaryDesc),
      truncate(job.cityName, 8),
      truncate(job.companySize || "-", 12),
    ]);
  });

  return table.toString();
}

/**
 * 渲染薪资分析
 */
export function renderSalaryAnalysis(analysis: SalaryAnalysis): string {
  const lines: string[] = [];
  lines.push(chalk.bold("📊 薪资分析"));
  lines.push(`  平均: ${chalk.green(formatK(analysis.average))} | 中位数: ${chalk.green(formatK(analysis.median))} | 最低: ${chalk.gray(formatK(analysis.min))} | 最高: ${chalk.yellow(formatK(analysis.max))}`);

  if (analysis.distribution.length > 0) {
    lines.push("");
    lines.push("  薪资分布:");
    const maxCount = Math.max(...analysis.distribution.map(d => d.count));
    for (const d of analysis.distribution) {
      const barLen = Math.round((d.count / maxCount) * 20);
      const bar = "█".repeat(barLen);
      lines.push(`  ${d.range.padEnd(8)} ${chalk.green(bar)} ${d.count} (${d.percentage}%)`);
    }
  }

  return lines.join("\n");
}

/**
 * 渲染技能分析
 */
export function renderSkillsAnalysis(skills: SkillAnalysisItem[], top = 10): string {
  const lines: string[] = [];
  lines.push(chalk.bold("📊 技能需求 Top" + Math.min(top, skills.length)));

  const displayed = skills.slice(0, top);
  for (const skill of displayed) {
    const barLen = Math.min(20, Math.round((skill.percentage / 100) * 20));
    const bar = "▓".repeat(barLen) + "░".repeat(20 - barLen);
    lines.push(`  ${skill.name.padEnd(15)} ${chalk.cyan(bar)} ${skill.count} (${skill.percentage}%)`);
  }

  return lines.join("\n");
}

/**
 * 渲染匹配结果
 */
export function renderMatchResults(results: MatchResult[], top = 10): string {
  const lines: string[] = [];
  lines.push(chalk.bold("🎯 岗位匹配结果"));

  const displayed = results.slice(0, top);
  for (let i = 0; i < displayed.length; i++) {
    const r = displayed[i];
    const scoreColor = r.score >= 80 ? chalk.green : r.score >= 50 ? chalk.yellow : chalk.red;
    lines.push(`  ${i + 1}. ${r.job.jobName} @ ${r.job.brandName} — ${scoreColor(r.score + "%")}`);
    if (r.matchedSkills.length > 0) {
      lines.push(`     ✅ 匹配: ${r.matchedSkills.join(", ")}`);
    }
    if (r.missingSkills.length > 0) {
      lines.push(`     ❌ 缺失: ${r.missingSkills.join(", ")}`);
    }
  }

  return lines.join("\n");
}

/**
 * 渲染 JSON envelope
 */
export function renderJson(data: unknown): string {
  const envelope = {
    ok: true,
    schema_version: "1",
    data,
  };
  return JSON.stringify(envelope, null, 2);
}

/**
 * 渲染简单 Markdown（粗体、代码）
 */
export function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, (_, content) => chalk.bold(content))
    .replace(/`(.+?)`/g, (_, content) => chalk.cyan(content));
}

// ── 工具函数 ──

function formatK(value: number): string {
  if (!Number.isFinite(value)) return "面议";
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return `${value}`;
}
