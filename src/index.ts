import { startRepl } from "./repl/repl.js";

startRepl().catch((err) => {
  console.error("启动失败:", err.message);
  process.exit(1);
});
