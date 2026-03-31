import type { Job, SalaryRange } from "../client/types.js";

/**
 * 解析薪资范围字符串
 * "20-30K" → { min: 20000, max: 30000 }
 * "50K以上" → { min: 50000, max: Infinity }
 * "3K以下" → { min: 0, max: 30000 }
 */
export function parseSalaryRange(desc: string): SalaryRange {
  const kMatch = desc.match(/(\d+)\s*[Kk]?\s*[-–—]\s*(\d+)\s*[Kk]/);
  if (kMatch) {
    return { min: parseInt(kMatch[1]) * 1000, max: parseInt(kMatch[2]) * 1000 };
  }

  const aboveMatch = desc.match(/(\d+)[Kk]\s*以上/);
  if (aboveMatch) {
    return { min: parseInt(aboveMatch[1]) * 1000, max: Infinity };
  }

  const belowMatch = desc.match(/(\d+)[Kk]\s*以下/);
  if (belowMatch) {
    return { min: 0, max: parseInt(belowMatch[1]) * 1000 };
  }

  return { min: 0, max: 0 };
}

/**
 * 截断字符串到指定长度
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

/**
 * 格式化职位为表格行数据
 */
export function formatJobRow(job: Job, index: number): {
  index: number;
  jobName: string;
  brandName: string;
  salary: string;
  city: string;
  scale: string;
} {
  return {
    index,
    jobName: truncate(job.jobName, 20),
    brandName: truncate(job.brandName, 15),
    salary: job.salaryDesc,
    city: truncate(job.cityName, 8),
    scale: truncate(job.companySize || "-", 12),
  };
}

/**
 * 格式化百分比
 */
export function formatPercentage(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}
