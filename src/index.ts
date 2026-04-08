import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// 手动加载 .env 文件到 process.env
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // 去掉引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

import { startRepl } from "./repl/repl.js";

startRepl().catch((err) => {
  console.error("启动失败:", err.message);
  process.exit(1);
});
