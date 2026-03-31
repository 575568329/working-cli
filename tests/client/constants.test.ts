import { describe, it, expect } from "vitest";
import {
  CITY_CODES,
  resolveCity,
  SEARCH_FILTER_OPTIONS,
  HEADERS,
  API_URLS,
  REQUIRED_COOKIES,
  BASE_URL,
} from "../../src/client/constants.js";

describe("constants", () => {
  it("BASE_URL 应为 zhipin.com", () => {
    expect(BASE_URL).toBe("https://www.zhipin.com");
  });

  it("API_URLS 应包含核心端点", () => {
    expect(API_URLS.SEARCH).toContain("search");
    expect(API_URLS.JOB_DETAIL).toContain("detail");
    expect(API_URLS.RECOMMEND).toContain("geekGetJob");
  });

  it("HEADERS 应包含浏览器指纹", () => {
    expect(HEADERS["User-Agent"]).toContain("Chrome");
    expect(HEADERS["sec-ch-ua"]).toBeDefined();
  });

  it("REQUIRED_COOKIES 应包含必需的 cookie", () => {
    expect(REQUIRED_COOKIES.has("__zp_stoken__")).toBe(true);
    expect(REQUIRED_COOKIES.size).toBeGreaterThanOrEqual(2);
  });
});

describe("resolveCity", () => {
  it("应返回城市编码", () => {
    expect(resolveCity("北京")).toBe("101010100");
    expect(resolveCity("上海")).toBe("101020100");
    expect(resolveCity("杭州")).toBe("101210100");
    expect(resolveCity("深圳")).toBe("101280600");
    expect(resolveCity("广州")).toBe("101280100");
  });

  it("数字字符串应透传", () => {
    expect(resolveCity("101010100")).toBe("101010100");
    expect(resolveCity("101210100")).toBe("101210100");
  });

  it("未知城市应返回全国", () => {
    expect(resolveCity("火星")).toBe(CITY_CODES["全国"]);
    expect(resolveCity("")).toBe(CITY_CODES["全国"]);
  });
});

describe("SEARCH_FILTER_OPTIONS", () => {
  it("应包含薪资选项", () => {
    expect(SEARCH_FILTER_OPTIONS.salary).toContain("20-30K");
    expect(SEARCH_FILTER_OPTIONS.salary.length).toBeGreaterThanOrEqual(8);
  });

  it("应包含经验选项", () => {
    expect(SEARCH_FILTER_OPTIONS.experience).toContain("3-5年");
  });

  it("应包含学历选项", () => {
    expect(SEARCH_FILTER_OPTIONS.degree).toContain("本科");
  });
});
