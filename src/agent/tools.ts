import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod/v3";
import type { SearchService } from "../services/search-service.js";
import type { AnalyzeService } from "../services/analyze-service.js";
import type { MatchService } from "../services/match-service.js";
import type { SharedContext } from "../repl/context.js";

export function createTools(deps: {
  searchService: SearchService;
  analyzeService: AnalyzeService;
  matchService: MatchService;
  context: SharedContext;
}) {
  const { searchService, analyzeService, matchService, context } = deps;

  const searchJobs = new DynamicStructuredTool({
    name: "search_jobs",
    description: "搜索 Boss 直聘职位。支持按关键词、城市、薪资、经验等筛选。",
    schema: z.object({
      keyword: z.string().describe("搜索关键词，如 Java、Python、前端"),
      city: z.string().optional().describe("城市名，如 杭州、上海、北京"),
      salary: z.string().optional().describe("薪资范围，如 20-30K"),
      experience: z.string().optional().describe("经验要求，如 3-5年"),
      degree: z.string().optional().describe("学历要求，如 本科"),
      page: z.number().optional().describe("页码，默认1"),
    }),
    func: async (input) => {
      try {
        const result = await searchService.search({
          query: input.keyword,
          city: input.city,
          salary: input.salary,
          experience: input.experience,
          degree: input.degree,
          page: input.page ?? 1,
        });
        context.setCurrentJobs(result.jobList);
        return JSON.stringify({
          total: result.totalCount,
          count: result.jobList.length,
          hasMore: result.hasMore,
          jobs: result.jobList.map(j => ({
            name: j.jobName,
            company: j.brandName,
            salary: j.salaryDesc,
            city: j.cityName,
            skills: j.skills,
          })),
        });
      } catch (err: any) {
        return JSON.stringify({ error: err.message });
      }
    },
  });

  const getJobDetail = new DynamicStructuredTool({
    name: "get_job_detail",
    description: "获取指定职位的详细信息。",
    schema: z.object({
      securityId: z.string().describe("职位安全ID"),
    }),
    func: async (input) => {
      try {
        const detail = await searchService.detail(input.securityId);
        return JSON.stringify(detail);
      } catch (err: any) {
        return JSON.stringify({ error: err.message });
      }
    },
  });

  const getRecommendations = new DynamicStructuredTool({
    name: "get_recommendations",
    description: "获取个性化推荐的职位列表。",
    schema: z.object({
      page: z.number().optional().describe("页码，默认1"),
    }),
    func: async (input) => {
      try {
        const result = await searchService.recommend(input.page ?? 1);
        context.setCurrentJobs(result.jobList);
        return JSON.stringify({
          total: result.totalCount,
          count: result.jobList.length,
          jobs: result.jobList.map(j => ({
            name: j.jobName,
            company: j.brandName,
            salary: j.salaryDesc,
            city: j.cityName,
          })),
        });
      } catch (err: any) {
        return JSON.stringify({ error: err.message });
      }
    },
  });

  const analyzeSalary = new DynamicStructuredTool({
    name: "analyze_salary",
    description: "分析当前搜索结果的薪资分布。如果用户说'分析薪资'或类似表达时使用。",
    schema: z.object({
      _unused: z.string().optional().describe("保留参数，可不传"),
    }),
    func: async () => {
      const jobs = context.getCurrentJobs();
      if (jobs.length === 0) {
        return JSON.stringify({ error: "没有搜索结果，请先搜索职位" });
      }
      const analysis = analyzeService.analyzeSalary(jobs);
      context.setSalaryAnalysis(analysis);
      return JSON.stringify(analysis);
    },
  });

  const analyzeSkills = new DynamicStructuredTool({
    name: "analyze_skills",
    description: "分析当前搜索结果的技能需求排名。如果用户说'分析技能'或类似表达时使用。",
    schema: z.object({
      _unused: z.string().optional().describe("保留参数，可不传"),
    }),
    func: async () => {
      const jobs = context.getCurrentJobs();
      if (jobs.length === 0) {
        return JSON.stringify({ error: "没有搜索结果，请先搜索职位" });
      }
      const skills = analyzeService.analyzeSkills(jobs);
      context.setSkillsAnalysis(skills);
      return JSON.stringify(skills);
    },
  });

  const matchJobs = new DynamicStructuredTool({
    name: "match_jobs",
    description: "根据用户技能匹配当前搜索结果中的岗位。如果用户提供自己的技能并要求匹配时使用。",
    schema: z.object({
      skills: z.string().describe("用户技能，逗号分隔，如 Java,Spring Boot,MySQL"),
    }),
    func: async (input) => {
      const jobs = context.getCurrentJobs();
      if (jobs.length === 0) {
        return JSON.stringify({ error: "没有搜索结果，请先搜索职位" });
      }
      const userSkills = input.skills.split(",").map(s => s.trim());
      const results = matchService.matchBySkills(userSkills, jobs);
      context.setMatchResults(results);
      return JSON.stringify(
        results.slice(0, 10).map(r => ({
          job: r.job.jobName,
          company: r.job.brandName,
          score: r.score,
          matchedSkills: r.matchedSkills,
          missingSkills: r.missingSkills,
        }))
      );
    },
  });

  return [searchJobs, getJobDetail, getRecommendations, analyzeSalary, analyzeSkills, matchJobs];
}
