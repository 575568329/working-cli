import type { ParsedCommand } from "../client/types.js";

export interface CommandDef {
  name: string;
  description: string;
  usage?: string;
  handler?: (cmd: ParsedCommand) => Promise<void>;
}

// 命令注册表（handler 在 REPL 启动时注入）
export const COMMANDS: Record<string, CommandDef> = {
  search:   { name: "search",   description: "搜索职位",        usage: "/search <关键词> [--city 城市] [--salary 薪资]" },
  recommend:{ name: "recommend",description: "个性化推荐",      usage: "/recommend [-p 页码]" },
  detail:   { name: "detail",   description: "职位详情",        usage: "/detail <securityId>" },
  show:     { name: "show",     description: "按编号查看",      usage: "/show <编号>" },
  analyze:  { name: "analyze",  description: "数据分析",        usage: "/analyze [--dimension salary|skills]" },
  match:    { name: "match",    description: "智能匹配",        usage: "/match --skills \"技能1,技能2\"" },
  export:   { name: "export",   description: "导出数据",        usage: "/export -o <文件路径> [--format csv|json]" },
  history:  { name: "history",  description: "浏览历史",        usage: "/history" },
  applied:  { name: "applied",  description: "已投递",          usage: "/applied" },
  me:       { name: "me",       description: "个人信息",        usage: "/me" },
  cities:   { name: "cities",   description: "城市列表",        usage: "/cities" },
  login:    { name: "login",    description: "登录认证",        usage: "/login" },
  logout:   { name: "logout",   description: "退出登录",        usage: "/logout" },
  status:   { name: "status",   description: "状态检查",        usage: "/status" },
  model:    { name: "model",    description: "切换模型",        usage: "/model <provider>" },
  config:   { name: "config",   description: "配置管理",        usage: "/config set <key> <value> | /config list | /config path" },
  help:     { name: "help",     description: "帮助",            usage: "/help [命令名]" },
  clear:    { name: "clear",    description: "清空上下文",      usage: "/clear" },
};

/**
 * 解析斜杠命令
 * /search Java --city 杭州 --salary 20-30K --json
 * → { name: "search", args: ["Java"], flags: { city: "杭州", salary: "20-30K", json: true } }
 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  // 去掉前导 /
  const withoutSlash = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;

  const tokens = tokenize(withoutSlash);

  const name = tokens[0] ?? "";
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let i = 1;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.startsWith("--")) {
      const flagName = token.slice(2);
      const nextToken = tokens[i + 1];
      // 下一个 token 不存在或者是另一个 flag → 布尔 flag
      if (!nextToken || nextToken.startsWith("--") || nextToken.startsWith("-")) {
        flags[flagName] = true;
        i++;
      } else {
        flags[flagName] = nextToken;
        i += 2;
      }
    } else if (token.startsWith("-") && token.length === 2) {
      // 短 flag 如 -p, -o, -n
      const flagName = token.slice(1);
      const nextToken = tokens[i + 1];
      if (!nextToken || nextToken.startsWith("--") || nextToken.startsWith("-")) {
        flags[flagName] = true;
        i++;
      } else {
        flags[flagName] = nextToken;
        i += 2;
      }
    } else {
      args.push(token);
      i++;
    }
  }

  return { name, args, flags };
}

/**
 * 将命令字符串拆分为 token
 * 支持引号包裹的参数: --skills "Java, Go, Python"
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === quoteChar) {
        inQuotes = false;
        quoteChar = "";
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuotes = true;
      quoteChar = char;
    } else if (char === " " || char === "\t") {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * 获取命令帮助文本
 */
export function getHelpText(commandName?: string): string {
  if (commandName && COMMANDS[commandName]) {
    const cmd = COMMANDS[commandName];
    return `${cmd.name}: ${cmd.description}\n用法: ${cmd.usage ?? "/" + cmd.name}`;
  }

  const lines = Object.values(COMMANDS).map(
    cmd => `  /${cmd.name.padEnd(10)} ${cmd.description}`
  );
  return `可用命令:\n${lines.join("\n")}\n\n输入 /help <命令名> 查看详细用法`;
}
