import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const fallback = resolve(process.cwd(), "scripts/test-os-fallback.cjs").replaceAll("\\", "/");
const cli = resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs");
const previous = process.env.NODE_OPTIONS?.trim();
const options = `${previous ? `${previous} ` : ""}--require=${fallback}`;
const result = spawnSync(process.execPath, [cli, "--test", "tests/*.test.ts"], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: options },
});

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
