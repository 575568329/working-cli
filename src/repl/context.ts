import type { Job, SalaryAnalysis, SkillAnalysisItem, MatchResult, UserProfile } from "../client/types.js";

export class SharedContext {
  private currentJobs: Job[] = [];
  private analysisResults: {
    salary?: SalaryAnalysis;
    skills?: SkillAnalysisItem[];
  } = {};
  private matchResults: MatchResult[] = [];
  private userProfile: UserProfile = { skills: [] };

  // ── 当前搜索结果 ──

  setCurrentJobs(jobs: Job[]): void {
    this.currentJobs = jobs;
  }

  getCurrentJobs(): Job[] {
    return this.currentJobs;
  }

  getJobByIndex(index: number): Job | undefined {
    // 编号从 1 开始
    if (index < 1 || index > this.currentJobs.length) return undefined;
    return this.currentJobs[index - 1];
  }

  // ── 分析结果 ──

  setSalaryAnalysis(analysis: SalaryAnalysis): void {
    this.analysisResults.salary = analysis;
  }

  getSalaryAnalysis(): SalaryAnalysis | undefined {
    return this.analysisResults.salary;
  }

  setSkillsAnalysis(skills: SkillAnalysisItem[]): void {
    this.analysisResults.skills = skills;
  }

  getSkillsAnalysis(): SkillAnalysisItem[] | undefined {
    return this.analysisResults.skills;
  }

  // ── 匹配结果 ──

  setMatchResults(results: MatchResult[]): void {
    this.matchResults = results;
  }

  getMatchResults(): MatchResult[] {
    return this.matchResults;
  }

  // ── 用户画像 ──

  setUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
  }

  getUserProfile(): UserProfile {
    return this.userProfile;
  }

  // ── 清空 ──

  clear(): void {
    this.currentJobs = [];
    this.analysisResults = {};
    this.matchResults = [];
  }
}
