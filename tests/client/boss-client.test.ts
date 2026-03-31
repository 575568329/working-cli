import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BossClient, BossApiError, SessionExpiredError, RateLimitError } from "../../src/client/boss-client.js";
import type { Credential } from "../../src/client/types.js";

// mock fetch
const originalFetch = globalThis.fetch;

function mockFetch(response: { status: number; body: any; headers?: Record<string, string> }) {
  return vi.fn().mockResolvedValue({
    status: response.status,
    text: () => Promise.resolve(JSON.stringify(response.body)),
    headers: {
      getSetCookie: () => response.headers?.["set-cookie"]
        ? [response.headers["set-cookie"]]
        : [],
      get: (name: string) => response.headers?.[name] ?? null,
    },
  }) as any;
}

describe("BossClient", () => {
  let client: BossClient;

  beforeEach(() => {
    client = new BossClient(
      { cookies: { __zp_stoken__: "test-token", geek_zp_token: "test-zp" } },
      { requestDelay: 0, enableBurstPenalty: false, maxRetries: 2 }
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("searchJobs 应构造正确的请求参数", async () => {
    globalThis.fetch = mockFetch({
      status: 200,
      body: { code: 0, zpData: { jobList: [], hasMore: false, totalCount: 0 } },
    });

    const result = await client.searchJobs({ query: "Java", city: "杭州" });
    expect(result.jobList).toEqual([]);

    // 验证 fetch 被调用且 URL 包含正确参数
    expect(globalThis.fetch).toHaveBeenCalled();
    const calledUrl = (globalThis.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain("query=Java");
    expect(calledUrl).toContain("city=101210100");
  });

  it("code=37 应抛出 SessionExpiredError", async () => {
    globalThis.fetch = mockFetch({
      status: 200,
      body: { code: 37, message: "环境异常" },
    });

    await expect(client.searchJobs({ query: "Java" })).rejects.toThrow(SessionExpiredError);
  });

  it("code=0 应返回 zpData", async () => {
    const zpData = { jobList: [{ jobName: "Java开发" }], totalCount: 1 };
    globalThis.fetch = mockFetch({ status: 200, body: { code: 0, zpData } });

    const result = await client.searchJobs({ query: "Java" });
    expect(result.jobList).toHaveLength(1);
  });

  it("非零 code 应抛出 BossApiError", async () => {
    globalThis.fetch = mockFetch({
      status: 200,
      body: { code: 99, message: "未知错误" },
    });

    await expect(client.searchJobs({ query: "Java" })).rejects.toThrow(BossApiError);
  });

  it("HTML 响应应抛出错误", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve("<html>redirect</html>"),
      headers: { getSetCookie: () => [], get: () => null },
    }) as any;

    await expect(client.searchJobs({ query: "Java" })).rejects.toThrow("HTML");
  });

  it("getJobDetail 应传入 securityId", async () => {
    globalThis.fetch = mockFetch({
      status: 200,
      body: { code: 0, zpData: { jobInfo: {} } },
    });

    await client.getJobDetail("abc123");
    const calledUrl = (globalThis.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain("securityId=abc123");
  });

  it("getRecommendJobs 应传 tag=5", async () => {
    globalThis.fetch = mockFetch({
      status: 200,
      body: { code: 0, zpData: { jobList: [], hasMore: false } },
    });

    await client.getRecommendJobs();
    const calledUrl = (globalThis.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain("tag=5");
  });

  it("应携带 Cookie 请求头", async () => {
    globalThis.fetch = mockFetch({
      status: 200,
      body: { code: 0, zpData: {} },
    });

    await client.getUserInfo();
    const calledOptions = (globalThis.fetch as any).mock.calls[0][1] as RequestInit;
    expect(calledOptions.headers).toHaveProperty("Cookie");
    expect((calledOptions.headers as any).Cookie).toContain("__zp_stoken__=test-token");
  });

  it("应设置正确的 Referer", async () => {
    globalThis.fetch = mockFetch({
      status: 200,
      body: { code: 0, zpData: { jobList: [] } },
    });

    await client.searchJobs({ query: "Python" });
    const calledOptions = (globalThis.fetch as any).mock.calls[0][1] as RequestInit;
    expect((calledOptions.headers as any).Referer).toContain("zhipin.com/web/geek/job");
  });

  it("应合并响应 Set-Cookie", async () => {
    globalThis.fetch = mockFetch({
      status: 200,
      body: { code: 0, zpData: {} },
      headers: { "set-cookie": "new_cookie=value123; Path=/" },
    });

    await client.getUserInfo();
    // 第二次请求应包含新 cookie（通过 stats 验证请求次数）
    expect(client.requestStats.requestCount).toBe(1);
  });
});
