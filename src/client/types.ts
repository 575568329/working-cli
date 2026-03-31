// 职位信息
export interface Job {
  securityId: string;
  jobName: string;
  cityName: string;
  salaryDesc: string; // "20-30K"
  brandName: string; // 公司名称
  companySize: string; // "1000-9999人"
  industry: string;
  financeStage: string; // 融资阶段
  jobType: number;
  skills: string[]; // ["Java", "Spring Boot"]
  jobLabels: string[];
  bossName: string;
  bossTitle: string;
  experience?: string; // "3-5年"
  degree?: string; // "本科"
  lid: string;
}

// 搜索参数
export interface SearchParams {
  query: string;
  city?: string;
  page?: number;
  pageSize?: number;
  experience?: string;
  degree?: string;
  salary?: string;
  industry?: string;
  scale?: string;
  stage?: string;
  jobType?: string;
}

// 搜索结果
export interface SearchResult {
  jobList: Job[];
  hasMore: boolean;
  totalCount: number;
  page: number;
}

// 职位详情
export interface JobDetail {
  jobInfo: {
    securityId: string;
    jobName: string;
    salaryDesc: string;
    cityName: string;
    experience: string;
    degree: string;
    jobType: number;
    skills: string[];
    jobLabels: string[];
    position: string;
    postDescription: string;
  };
  bossInfo: {
    bossName: string;
    bossTitle: string;
    brandName: string;
    companySize: string;
    industry: string;
    financeStage: string;
  };
}

// 用户信息
export interface UserInfo {
  userId: string;
  name: string;
  avatar: string;
  tinyAvatar: string;
}

// 用户画像
export interface UserProfile {
  skills: string[];
  experience?: string;
  expectedSalary?: string;
  expectedCities?: string[];
  exclude?: string[];
}

// 薪资范围
export interface SalaryRange {
  min: number;
  max: number;
}

// 薪资分析结果
export interface SalaryAnalysis {
  average: number;
  median: number;
  min: number;
  max: number;
  distribution: { range: string; count: number; percentage: number }[];
}

// 技能分析结果
export interface SkillAnalysisItem {
  name: string;
  count: number;
  percentage: number;
}

// 匹配结果
export interface MatchResult {
  job: Job;
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  reason: string;
}

// API 响应 envelope
export interface ApiResponse {
  code: number;
  message: string;
  zpData?: unknown;
}

// 认证凭证
export interface Credential {
  cookies: Record<string, string>;
  savedAt?: number;
}

// 命令解析结果
export interface ParsedCommand {
  name: string;
  args: string[];
  flags: Record<string, string | boolean>;
}
