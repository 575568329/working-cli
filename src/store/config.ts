import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import path from "path";
import { DEFAULT_CONFIG, type AppConfig } from "./defaults.js";

export function loadConfig(configDir?: string): AppConfig {
  // 深拷贝默认配置
  let config: AppConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  // 1. 用户全局配置 ~/.boss-agent/config.json
  const userConfigPath = configDir
    ? path.join(configDir, "config.json")
    : path.join(homedir(), ".boss-agent", "config.json");
  if (existsSync(userConfigPath)) {
    try {
      const userConfig = JSON.parse(readFileSync(userConfigPath, "utf-8"));
      config = deepMerge(config, userConfig);
    } catch {
      // 解析失败时忽略，使用默认值
    }
  }

  // 2. 项目级配置 ./boss-agent.json
  const projectConfigPath = "boss-agent.json";
  if (existsSync(projectConfigPath)) {
    try {
      const projectConfig = JSON.parse(readFileSync(projectConfigPath, "utf-8"));
      config = deepMerge(config, projectConfig);
    } catch {
      // 解析失败时忽略
    }
  }

  // 3. 环境变量覆盖 API Key
  if (process.env.OPENAI_API_KEY) {
    config.llm.apiKey = process.env.OPENAI_API_KEY;
  } else if (process.env.ANTHROPIC_API_KEY) {
    config.llm.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  return config;
}

export function saveConfig(configDir: string, updates: Partial<AppConfig>): void {
  const dir = configDir || path.join(homedir(), ".boss-agent");
  mkdirSync(dir, { recursive: true });

  const configPath = path.join(dir, "config.json");

  // 读取现有配置，合并更新
  let existing: Partial<AppConfig> = {};
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch {
      // 忽略
    }
  }

  const merged = deepMerge(existing, updates);
  writeFileSync(configPath, JSON.stringify(merged, null, 2), "utf-8");
}

export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceVal = source[key];
    const targetVal = target[key];
    if (
      sourceVal &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, any>,
        sourceVal as Record<string, any>
      ) as T[keyof T];
    } else {
      result[key] = sourceVal as T[keyof T];
    }
  }
  return result;
}
