import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

const [nodeEnv, command, ...args] = process.argv.slice(2);

if (!nodeEnv || !command) {
  console.error("Usage: node scripts/run-with-node-env.mjs <NODE_ENV> <command> [...args]");
  process.exit(1);
}

function resolveCommand(commandName) {
  const extensions = process.platform === "win32"
    ? [".cmd", ".exe", ".bat", ""]
    : [""];

  for (const directory of (process.env.PATH || "").split(delimiter)) {
    for (const extension of extensions) {
      const candidate = join(directory, `${commandName}${extension}`);
      if (existsSync(candidate)) return candidate;
    }
  }

  return commandName;
}

const child = spawn(resolveCommand(command), args, {
  env: { ...process.env, NODE_ENV: nodeEnv },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Failed to start ${command}: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
