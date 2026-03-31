import type { Credential } from "./types.js";
import type { AppConfig } from "../store/defaults.js";
import {
  BASE_URL,
  API_URLS,
  HEADERS,
  WEB_GEEK_JOB_URL,
  WEB_GEEK_RECOMMEND_URL,
  resolveCity,
} from "./constants.js";
import {
  sleep,
  calculateBurstPenalty,
  calculateRateLimitBackoff,
  calculateRequestDelay,
} from "../utils/delay.js";

// ── 异常类 ──
export class BossApiError extends Error {
  constructor(
    message: string,
    public code?: number,
    public response?: any
  ) {
    super(message);
    this.name = "BossApiError";
  }
}

export class SessionExpiredError extends BossApiError {
  constructor() {
    super("登录态已过期，请重新执行 /login", 37);
    this.name = "SessionExpiredError";
  }
}

export class RateLimitError extends BossApiError {
  constructor() {
    super("请求过于频繁，已自动冷却", 9);
    this.name = "RateLimitError";
  }
}

export class ParamError extends BossApiError {
  constructor(message: string, code?: number) {
    super(message, code);
    this.name = "ParamError";
  }
}

// ── BossClient ──
export class BossClient {
  private cookies: Record<string, string>;
  private config: AppConfig["antiDetect"];
  private lastRequestTime = 0;
  private requestCount = 0;
  private rateLimitCount = 0;
  private recentRequestTimes: number[] = [];

  constructor(credential: Credential | null, config: AppConfig["antiDetect"]) {
    this.cookies = credential?.cookies ?? {};
    this.config = config;
  }

  // ── 限流和延迟 ──

  private async enforceRateLimit(): Promise<void> {
    const baseDelay = this.config.requestDelay * 1000;
    const delay = calculateRequestDelay(baseDelay);
    const elapsed = Date.now() - this.lastRequestTime;
    const waitTime = Math.max(0, delay - elapsed);

    if (waitTime > 0) {
      await sleep(waitTime);
    }

    const burst = calculateBurstPenalty(this.recentRequestTimes);
    if (burst > 0) {
      await sleep(burst);
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
    this.recentRequestTimes.push(Date.now());
    // 只保留最近 12 次
    if (this.recentRequestTimes.length > 12) {
      this.recentRequestTimes = this.recentRequestTimes.slice(-12);
    }
  }

  private mergeResponseCookies(setCookieHeaders: string[]): void {
    for (const header of setCookieHeaders) {
      const [pair] = header.split(";");
      const eqIndex = pair.indexOf("=");
      if (eqIndex > 0) {
        const name = pair.slice(0, eqIndex).trim();
        const value = pair.slice(eqIndex + 1).trim();
        if (name && value) {
          this.cookies[name] = value;
        }
      }
    }
  }

  private buildHeaders(url: string, params?: Record<string, any>): Record<string, string> {
    const headers: Record<string, string> = { ...HEADERS };

    // Referer 策略
    if (url === API_URLS.SEARCH) {
      const q = params?.query ? `?query=${encodeURIComponent(params.query)}` : "";
      headers["Referer"] = `${WEB_GEEK_JOB_URL}${q}`;
    } else if (url === API_URLS.RECOMMEND) {
      headers["Referer"] = WEB_GEEK_RECOMMEND_URL;
    } else if (url === API_URLS.JOB_DETAIL || url === API_URLS.JOB_CARD) {
      headers["Referer"] = WEB_GEEK_JOB_URL;
    } else {
      headers["Referer"] = WEB_GEEK_JOB_URL;
    }

    // Cookie
    if (Object.keys(this.cookies).length > 0) {
      headers["Cookie"] = Object.entries(this.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    }

    return headers;
  }

  // ── HTTP 请求核心 ──

  private async request(
    method: "GET" | "POST",
    url: string,
    params?: Record<string, any>
  ): Promise<any> {
    await this.enforceRateLimit();

    const fullUrl = `${BASE_URL}${url}`;
    const headers = this.buildHeaders(url, params);
    const maxRetries = this.config.maxRetries;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        let fetchUrl = fullUrl;
        const fetchInit: RequestInit = { method, headers };

        if (method === "GET" && params) {
          const searchParams = new URLSearchParams();
          for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null) {
              searchParams.append(k, String(v));
            }
          }
          fetchUrl = `${fullUrl}?${searchParams.toString()}`;
        }

        const response = await fetch(fetchUrl, fetchInit);

        // 合并响应 Cookie
        const setCookie = response.headers.getSetCookie?.() ?? [];
        if (setCookie.length > 0) {
          this.mergeResponseCookies(setCookie);
        }

        // 429/5xx 重试
        if ([429, 500, 502, 503, 504].includes(response.status)) {
          const wait = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          await sleep(wait);
          lastError = new BossApiError(
            `HTTP ${response.status}, retrying (${attempt + 1}/${maxRetries})`
          );
          continue;
        }

        const text = await response.text();

        // HTML 检测（重定向到登录页）
        if (text.startsWith("<")) {
          throw new BossApiError(`收到 HTML 响应，可能被重定向到登录页`);
        }

        return JSON.parse(text);
      } catch (err) {
        if (err instanceof BossApiError) {
          throw err;
        }
        lastError = err as Error;
        const wait = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        await sleep(wait);
      }
    }

    throw new BossApiError(
      `请求失败，重试 ${maxRetries} 次后仍失败: ${lastError?.message ?? "unknown"}`
    );
  }

  // ── 响应处理 ──

  private handleResponse(data: any, action: string): any {
    const code = data?.code ?? -1;
    const message = data?.message ?? "Unknown error";

    if (code === 0) {
      return data.zpData ?? {};
    }

    if (code === 37) throw new SessionExpiredError();
    if (code === 17 || code === 19) throw new ParamError(message, code);
    if (code === 9) {
      this.rateLimitCount++;
      throw new RateLimitError();
    }

    throw new BossApiError(`${action}: ${message} (code=${code})`, code, data);
  }

  private async get(url: string, params?: Record<string, any>, action = ""): Promise<any> {
    const data = await this.request("GET", url, params);
    try {
      const result = this.handleResponse(data, action);
      this.rateLimitCount = 0; // 成功时重置
      return result;
    } catch (err) {
      if (err instanceof RateLimitError) {
        // 限流后自动重试一次
        const cooldown = calculateRateLimitBackoff(this.rateLimitCount);
        await sleep(cooldown);
        const retryData = await this.request("GET", url, params);
        const result = this.handleResponse(retryData, action);
        this.rateLimitCount = 0;
        return result;
      }
      throw err;
    }
  }

  // ── 公开 API ──

  async searchJobs(params: {
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
  }): Promise<any> {
    const searchParams: Record<string, any> = {
      query: params.query,
      city: params.city ? resolveCity(params.city) : "100010000",
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 15,
    };
    if (params.experience) searchParams.experience = params.experience;
    if (params.degree) searchParams.degree = params.degree;
    if (params.salary) searchParams.salary = params.salary;
    if (params.industry) searchParams.industry = params.industry;
    if (params.scale) searchParams.scale = params.scale;
    if (params.stage) searchParams.stage = params.stage;
    if (params.jobType) searchParams.jobType = params.jobType;

    return this.get(API_URLS.SEARCH, searchParams, "搜索职位");
  }

  async getJobDetail(securityId: string, lid?: string): Promise<any> {
    const params: Record<string, string> = { securityId };
    if (lid) params.lid = lid;
    return this.get(API_URLS.JOB_DETAIL, params, "职位详情");
  }

  async getRecommendJobs(page = 1): Promise<any> {
    return this.get(
      API_URLS.RECOMMEND,
      { page, tag: 5, isActive: "true" },
      "推荐职位"
    );
  }

  async getUserInfo(): Promise<any> {
    return this.get(API_URLS.USER_INFO, undefined, "用户信息");
  }

  async getDeliverList(page = 1): Promise<any> {
    return this.get(API_URLS.DELIVER_LIST, { page }, "已投递列表");
  }

  async getJobHistory(page = 1): Promise<any> {
    return this.get(API_URLS.JOB_HISTORY, { page }, "浏览历史");
  }

  async getFriendList(): Promise<any> {
    return this.get(API_URLS.FRIEND_LIST, undefined, "好友列表");
  }

  get requestStats() {
    return {
      requestCount: this.requestCount,
      rateLimitCount: this.rateLimitCount,
      lastRequestTime: this.lastRequestTime,
    };
  }
}
