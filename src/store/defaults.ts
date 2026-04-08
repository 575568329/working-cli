import path from "path";
import { homedir } from "os";

export interface AppConfig {
  llm: {
    provider: "openai" | "claude" | "ollama";
    model: string;
    apiKey?: string;
    baseUrl?: string;
  };
  search: {
    defaultCity: string;
    defaultSalary?: string;
    pageSize: number;
  };
  profile: {
    skills: string[];
    experience?: string;
    expectedSalary?: string;
    expectedCities?: string[];
    exclude?: string[];
  };
  antiDetect: {
    requestDelay: number;
    enableBurstPenalty: boolean;
    maxRetries: number;
  };
  store: {
    dbPath: string;
  };
}

export const DEFAULT_CONFIG: AppConfig = {
  llm: {
    provider: "openai",
    model: "glm-5",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
  },
  search: {
    defaultCity: "全国",
    pageSize: 15,
  },
  profile: {
    skills: [],
  },
  antiDetect: {
    requestDelay: 1.0,
    enableBurstPenalty: true,
    maxRetries: 3,
  },
  store: {
    dbPath: path.join(homedir(), ".boss-agent", "data.db"),
  },
};
