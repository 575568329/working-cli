import readline from "readline";
import chalk from "chalk";
import type { AppConfig } from "../store/defaults.js";
import { loadConfig } from "../store/config.js";
import { Database } from "../store/db.js";
import { SharedContext } from "./context.js";
import { BossClient } from "../client/boss-client.js";
import { getCredential } from "../client/auth.js";
import { SearchService } from "../services/search-service.js";
import { AnalyzeService } from "../services/analyze-service.js";
import { MatchService } from "../services/match-service.js";
import { ExportService } from "../services/export-service.js";
import { parseCommand, getHelpText, COMMANDS } from "../commands/router.js";
import {
  renderJobTable,
  renderSalaryAnalysis,
  renderSkillsAnalysis,
  renderMatchResults,
  renderJson,
} from "./renderer.js";
import { createBossAgent, type BossAgent } from "../agent/agent.js";
import { CITY_CODES } from "../client/constants.js";

const BANNER = `
${chalk.cyan("Boss Agent v0.1.0")} — ${chalk.gray("Boss直聘求职助手")}
输入自然语言对话，/ 开头执行命令，${chalk.yellow("/help")} 查看帮助，${chalk.yellow("exit")} 退出
`;

export async function startRepl(): Promise<void> {
  // 1. 加载配置
  const config = loadConfig();

  // 2. 初始化数据库
  const db = new Database(config.store.dbPath);
  await db.init();

  // 3. 初始化 SharedContext
  const context = new SharedContext();

  // 4. 创建 BossClient
  const credential = getCredential();
  const bossClient = new BossClient(credential, config.antiDetect);

  // 5. 初始化 Services
  const searchService = new SearchService(bossClient, db);
  const analyzeService = new AnalyzeService();
  const matchService = new MatchService();
  const exportService = new ExportService();

  // 6. 创建 Agent（如 LLM 可用）
  let agent: BossAgent | null = null;
  if (config.llm.apiKey) {
    try {
      agent = await createBossAgent({
        llmConfig: config.llm,
        searchService,
        analyzeService,
        matchService,
        context,
        db,
      });
    } catch {
      // LLM 不可用，降级为纯命令模式
    }
  }

  // 7. 进入 REPL 循环
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(BANNER);

  const prompt = () =>
    rl.question(chalk.green("> "), async (input: string) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      if (isExit(trimmed)) {
        console.log(chalk.gray("再见！祝你求职顺利"));
        db.close();
        rl.close();
        return;
      }

      try {
        if (trimmed.startsWith("/")) {
          await handleCommand(trimmed, {
            config,
            context,
            searchService,
            analyzeService,
            matchService,
            exportService,
            bossClient,
            db,
          });
        } else {
          await handleNaturalLanguage(trimmed, agent);
        }
      } catch (err: any) {
        console.error(chalk.red(`错误: ${err.message}`));
      }

      prompt();
    });

  prompt();
}

function isExit(input: string): boolean {
  return ["exit", "quit", "q"].includes(input.toLowerCase());
}

interface CommandContext {
  config: AppConfig;
  context: SharedContext;
  searchService: SearchService;
  analyzeService: AnalyzeService;
  matchService: MatchService;
  exportService: ExportService;
  bossClient: BossClient;
  db: Database;
}

async function handleCommand(
  input: string,
  ctx: CommandContext
): Promise<void> {
  const cmd = parseCommand(input);

  switch (cmd.name) {
    case "help": {
      const topic = cmd.args[0];
      console.log(getHelpText(topic));
      break;
    }

    case "search": {
      const keyword = cmd.args[0] ?? "";
      if (!keyword) {
        console.log(
          chalk.yellow("请提供搜索关键词，如: /search Java --city 杭州")
        );
        break;
      }
      console.log(chalk.cyan("正在搜索..."));
      const result = await ctx.searchService.search({
        query: keyword,
        city: cmd.flags.city as string,
        salary: cmd.flags.salary as string,
        experience: cmd.flags.experience as string,
        degree: cmd.flags.degree as string,
        industry: cmd.flags.industry as string,
        scale: cmd.flags.scale as string,
        stage: cmd.flags.stage as string,
        jobType: cmd.flags.jobType as string,
        page:
          typeof cmd.flags.p === "string" ? parseInt(cmd.flags.p) : 1,
        pageSize: ctx.config.search.pageSize,
      });
      ctx.context.setCurrentJobs(result.jobList);

      if (cmd.flags.json) {
        console.log(
          renderJson({ jobList: result.jobList, totalCount: result.totalCount })
        );
      } else {
        console.log(renderJobTable(result.jobList));
        console.log(
          chalk.gray(
            `共 ${result.totalCount} 条结果，当前第 ${result.page} 页${
              result.hasMore
                ? "，输入 /search ... -p " + (result.page + 1) + " 翻页"
                : ""
            }`
          )
        );
      }
      break;
    }

    case "recommend": {
      const page =
        typeof cmd.flags.p === "string" ? parseInt(cmd.flags.p) : 1;
      console.log(chalk.cyan("获取推荐..."));
      const result = await ctx.searchService.recommend(page);
      ctx.context.setCurrentJobs(result.jobList);
      console.log(renderJobTable(result.jobList));
      console.log(chalk.gray(`共 ${result.totalCount} 条推荐`));
      break;
    }

    case "show": {
      const index = parseInt(cmd.args[0] ?? "0");
      const job = ctx.context.getJobByIndex(index);
      if (!job) {
        console.log(chalk.yellow(`无效编号 ${index}，请先搜索职位`));
        break;
      }
      console.log(renderJson(job));
      break;
    }

    case "detail": {
      const securityId = cmd.args[0];
      if (!securityId) {
        console.log(chalk.yellow("请提供 securityId，如: /detail xxx"));
        break;
      }
      console.log(chalk.cyan("获取详情..."));
      const detail = await ctx.searchService.detail(securityId);
      console.log(renderJson(detail));
      break;
    }

    case "analyze": {
      const jobs = ctx.context.getCurrentJobs();
      if (jobs.length === 0) {
        console.log(chalk.yellow("没有搜索结果，请先搜索职位"));
        break;
      }
      const dimension = (cmd.flags.dimension as string) ?? "salary";
      if (dimension === "salary" || dimension === "all") {
        const analysis = ctx.analyzeService.analyzeSalary(jobs);
        ctx.context.setSalaryAnalysis(analysis);
        console.log(renderSalaryAnalysis(analysis));
      }
      if (dimension === "skills" || dimension === "all") {
        const skills = ctx.analyzeService.analyzeSkills(jobs);
        ctx.context.setSkillsAnalysis(skills);
        console.log(renderSkillsAnalysis(skills));
      }
      break;
    }

    case "match": {
      const jobs = ctx.context.getCurrentJobs();
      if (jobs.length === 0) {
        console.log(chalk.yellow("没有搜索结果，请先搜索职位"));
        break;
      }
      const skillsStr = cmd.flags.skills as string;
      if (!skillsStr) {
        console.log(
          chalk.yellow('请提供技能，如: /match --skills "Java,MySQL"')
        );
        break;
      }
      const skills = skillsStr.split(",").map((s) => s.trim());
      const results = ctx.matchService.matchBySkills(skills, jobs);
      ctx.context.setMatchResults(results);
      console.log(renderMatchResults(results));
      break;
    }

    case "export": {
      const jobs = ctx.context.getCurrentJobs();
      if (jobs.length === 0) {
        console.log(chalk.yellow("没有数据可导出"));
        break;
      }
      const outputPath = (cmd.flags.o as string) ?? "jobs.csv";
      const format = (cmd.flags.format as string) ?? "csv";
      if (format === "csv") {
        ctx.exportService.exportCSV(jobs, outputPath);
      } else {
        ctx.exportService.exportJSON(jobs, outputPath);
      }
      console.log(
        chalk.green(`已导出 ${jobs.length} 条记录到 ${outputPath}`)
      );
      break;
    }

    case "status": {
      const hasCredential = !!getCredential();
      const status = hasCredential
        ? chalk.green("已登录")
        : chalk.red("未登录");
      console.log(
        `${status} | 模型: ${ctx.config.llm.model} | Provider: ${ctx.config.llm.provider}`
      );
      break;
    }

    case "cities": {
      const cities = Object.keys(CITY_CODES);
      const rows: string[] = [];
      for (let i = 0; i < cities.length; i += 5) {
        rows.push(
          cities
            .slice(i, i + 5)
            .map((c) => c.padEnd(8))
            .join(" ")
        );
      }
      console.log(chalk.cyan("支持的城市:"));
      console.log(rows.join("\n"));
      break;
    }

    case "clear": {
      ctx.context.clear();
      console.log(chalk.green("上下文已清空"));
      break;
    }

    case "model": {
      const provider = cmd.args[0];
      if (!provider) {
        console.log(
          chalk.gray(
            `当前: ${ctx.config.llm.provider}/${ctx.config.llm.model}`
          )
        );
        break;
      }
      console.log(
        chalk.gray(
          "模型切换暂未实现，请使用 /config set llm.provider <provider>"
        )
      );
      break;
    }

    case "config": {
      const subCommand = cmd.args[0];
      if (subCommand === "list") {
        console.log(renderJson(ctx.config));
      } else if (subCommand === "path") {
        console.log(chalk.gray("~/.boss-agent/config.json"));
      } else if (subCommand === "set") {
        const key = cmd.args[1];
        const value = cmd.args[2];
        if (!key || value === undefined) {
          console.log(chalk.yellow("用法: /config set <key> <value>"));
          break;
        }
        try {
          const { saveConfig } = await import("../store/config.js");
          // 更新内存中的配置
          const keys = key.split(".");
          let obj: Record<string, unknown> = ctx.config as any;
          let current: unknown = obj;
          for (let ki = 0; ki < keys.length - 1; ki++) {
            const k = keys[ki];
            if (current && typeof current === "object") {
              current = (current as Record<string, unknown>)[k];
            } else {
              current = undefined;
              break;
            }
          }
          if (current !== undefined && typeof current === "object") {
            const lastKey = keys[keys.length - 1];
            const parsed = lastKey === "skills" && value.includes(",")
              ? value.split(",").map((s: string) => s.trim())
              : value;
            (current as Record<string, unknown>)[lastKey] = parsed;
          }
          saveConfig("~/.boss-agent", ctx.config);
          console.log(chalk.green(`已设置 ${key}`));
        } catch (err: any) {
          console.log(chalk.red(`设置失败: ${err.message}`));
        }
      } else {
        console.log(getHelpText("config"));
      }
      break;
    }

    case "login":
    case "logout":
    case "history":
    case "applied":
    case "me": {
      console.log(chalk.yellow(`/${cmd.name} 功能开发中`));
      break;
    }

    default:
      console.log(
        chalk.yellow(`未知命令: /${cmd.name}，输入 /help 查看帮助`)
      );
  }
}

async function handleNaturalLanguage(
  input: string,
  agent: BossAgent | null
): Promise<void> {
  if (!agent) {
    console.log(
      chalk.yellow(
        "LLM 未配置，无法处理自然语言。请配置 API Key 后重试，或使用 / 命令。"
      )
    );
    return;
  }
  console.log(chalk.gray("思考中..."));
  const response = await agent.call(input);
  console.log(response);
}
