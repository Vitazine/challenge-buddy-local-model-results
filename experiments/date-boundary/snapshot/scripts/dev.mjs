import { spawn } from "node:child_process";

const env = { ...process.env, NODE_ENV: "development", DEV_AUTH: "true" };
const children = [
  spawn(
    process.execPath,
    ["--import", "tsx", "--env-file-if-exists=.env", "server/index.ts"],
    { env, stdio: "inherit" },
  ),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js"], {
    env,
    stdio: "inherit",
  }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill("SIGTERM"));
  process.exitCode = code;
}
children.forEach((child) => child.on("exit", (code) => stop(code ?? 0)));
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
