import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const botDir = join(root, "londo-bot-main");
const siteDir = join(root, "londo-site-main");
const envFile = join(botDir, ".testingenv");

function loadEnvFile(file) {
  const values = {};
  if (!existsSync(file)) return values;
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

const env = {
  ...process.env,
  ...loadEnvFile(envFile),
  NODE_ENV: "production",
  PORT: "3000",
  HOSTNAME: "0.0.0.0",
  LONDO_BOT_HOST: "127.0.0.1",
  LONDO_BOT_INTERNAL_PORT: "3001",
  LONDO_BOT_INTERNAL_URL: "http://127.0.0.1:3001",
  LONDO_ENV_FILE: envFile,
};

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [
  spawn(npm, ["start"], { cwd: siteDir, env, stdio: "inherit" }),
  spawn(npm, ["start"], { cwd: botDir, env, stdio: "inherit" }),
];

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 5_000).unref();
}

for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => shutdown(0));
for (const child of children) {
  child.once("error", (error) => { console.error(`[londo] Failed to start child process: ${error.message}`); shutdown(1); });
  child.once("exit", (code) => {
    if (!shuttingDown) {
      console.error(`[londo] A child process exited with code ${code ?? 1}; stopping the other process.`);
      shutdown(code ?? 1);
    }
  });
}
