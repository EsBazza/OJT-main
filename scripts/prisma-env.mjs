import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const envPath = resolve(process.cwd(), ".env.local");
let contents;
try {
  contents = await readFile(envPath, "utf8");
} catch {
  process.stderr.write("Create .env.local from .env.example and configure the database URLs first.\n");
  process.exit(1);
}

for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
  if (process.env[key]) continue;
  const line = contents.split(/\r?\n/).find((item) => item.startsWith(`${key}=`));
  if (!line) continue;
  let value = line.slice(key.length + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  process.env[key] = value;
}

// Supabase's session pooler on 5432 supports schema operations from IPv4-only networks.
try {
  const database = new URL(process.env.DATABASE_URL ?? "");
  if (database.hostname.endsWith("pooler.supabase.com") && database.port === "5432") {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
} catch {
  process.stderr.write("DATABASE_URL is missing or invalid.\n");
  process.exit(1);
}

const prismaCli = resolve(process.cwd(), "node_modules/prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], { stdio: "inherit", env: process.env });
if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
