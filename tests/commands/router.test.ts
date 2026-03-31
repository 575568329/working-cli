import { describe, it, expect } from "vitest";
import { parseCommand, getHelpText, COMMANDS } from "../../src/commands/router.js";

describe("parseCommand", () => {
  it("应解析简单命令", () => {
    const cmd = parseCommand("/status");
    expect(cmd.name).toBe("status");
    expect(cmd.args).toEqual([]);
    expect(cmd.flags).toEqual({});
  });

  it("应解析带参数和标志的命令", () => {
    const cmd = parseCommand('/search Java --city 杭州 --salary 20-30K --json');
    expect(cmd.name).toBe("search");
    expect(cmd.args).toEqual(["Java"]);
    expect(cmd.flags.city).toBe("杭州");
    expect(cmd.flags.salary).toBe("20-30K");
    expect(cmd.flags.json).toBe(true);
  });

  it("应解析 /config set 子命令", () => {
    const cmd = parseCommand("/config set llm.provider claude");
    expect(cmd.name).toBe("config");
    expect(cmd.args).toEqual(["set", "llm.provider", "claude"]);
  });

  it("应解析短 flag", () => {
    const cmd = parseCommand("/export -o jobs.csv --format csv");
    expect(cmd.name).toBe("export");
    expect(cmd.flags.o).toBe("jobs.csv");
    expect(cmd.flags.format).toBe("csv");
  });

  it("应解析引号包裹的参数", () => {
    const cmd = parseCommand('/match --skills "Java, Go, Python"');
    expect(cmd.name).toBe("match");
    expect(cmd.flags.skills).toBe("Java, Go, Python");
  });

  it("应解析布尔 flag 在末尾", () => {
    const cmd = parseCommand("/search Java --json");
    expect(cmd.flags.json).toBe(true);
  });

  it("应解析多个位置参数", () => {
    const cmd = parseCommand("/detail abc123");
    expect(cmd.name).toBe("detail");
    expect(cmd.args).toEqual(["abc123"]);
  });

  it("无前导斜杠也能解析", () => {
    const cmd = parseCommand("search Java --city 杭州");
    expect(cmd.name).toBe("search");
    expect(cmd.args).toEqual(["Java"]);
  });

  it("空输入返回空 name", () => {
    const cmd = parseCommand("");
    expect(cmd.name).toBe("");
  });
});

describe("getHelpText", () => {
  it("应返回所有命令的帮助", () => {
    const help = getHelpText();
    expect(help).toContain("search");
    expect(help).toContain("可用命令");
  });

  it("应返回单个命令的帮助", () => {
    const help = getHelpText("search");
    expect(help).toContain("搜索职位");
    expect(help).toContain("/search");
  });

  it("未知命令返回全部帮助", () => {
    const help = getHelpText("nonexist");
    expect(help).toContain("可用命令");
  });
});

describe("COMMANDS", () => {
  it("应包含所有必要命令", () => {
    const required = ["search", "recommend", "detail", "show", "analyze", "match",
      "export", "login", "logout", "status", "config", "help"];
    for (const name of required) {
      expect(COMMANDS[name]).toBeDefined();
      expect(COMMANDS[name].description.length).toBeGreaterThan(0);
    }
  });
});
