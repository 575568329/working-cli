import type { Job, SalaryAnalysis, SkillAnalysisItem } from "../client/types.js";
import { parseSalaryRange } from "../utils/format.js";

export class AnalyzeService {
  analyzeSalary(jobs: Job[]): SalaryAnalysis {
    if (jobs.length === 0) {
      return { average: 0, median: 0, min: 0, max: 0, distribution: [] };
    }

    const salaries = jobs
      .map(job => parseSalaryRange(job.salaryDesc))
      .filter(s => s.min > 0 || s.max > 0);

    if (salaries.length === 0) {
      return { average: 0, median: 0, min: 0, max: 0, distribution: [] };
    }

    // 用 min 值做统计
    const mins = salaries.map(s => s.min).sort((a, b) => a - b);
    const maxs = salaries.map(s => s.max).filter(m => m !== Infinity);

    const sum = mins.reduce((a, b) => a + b, 0);
    const average = Math.round(sum / mins.length);
    const median = this.calculateMedian(mins);
    const min = mins[0];
    const max = maxs.length > 0 ? Math.max(...maxs) : mins[mins.length - 1];

    // 分布统计
    const distribution = this.calculateDistribution(salaries);

    return { average, median, min, max, distribution };
  }

  analyzeSkills(jobs: Job[]): SkillAnalysisItem[] {
    const skillCount = new Map<string, number>();
    const total = jobs.length;

    for (const job of jobs) {
      for (const skill of job.skills) {
        const normalized = skill.trim();
        if (normalized) {
          skillCount.set(normalized, (skillCount.get(normalized) ?? 0) + 1);
        }
      }
    }

    const result: SkillAnalysisItem[] = [];
    for (const [name, count] of skillCount) {
      result.push({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      });
    }

    return result.sort((a, b) => b.count - a.count);
  }

  private calculateMedian(sorted: number[]): number {
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }
    return sorted[mid];
  }

  private calculateDistribution(
    salaries: { min: number; max: number }[]
  ): { range: string; count: number; percentage: number }[] {
    // 定义薪资区间
    const ranges = [
      { label: "5K以下", min: 0, max: 5000 },
      { label: "5-10K", min: 5000, max: 10000 },
      { label: "10-15K", min: 10000, max: 15000 },
      { label: "15-20K", min: 15000, max: 20000 },
      { label: "20-30K", min: 20000, max: 30000 },
      { label: "30-50K", min: 30000, max: 50000 },
      { label: "50K以上", min: 50000, max: Infinity },
    ];

    const total = salaries.length;
    return ranges.map(r => {
      const count = salaries.filter(s => {
        const avg = (s.min + (s.max === Infinity ? s.min * 1.5 : s.max)) / 2;
        return avg >= r.min && avg < r.max;
      }).length;
      return {
        range: r.label,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    }).filter(r => r.count > 0);
  }
}
