import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const migrations = [
  "0001_initial_schema.sql",
  "0002_analysis_job_metadata.sql",
];

for (const fileName of migrations) {
  const filePath = resolve("packages/storage/migrations", fileName);
  console.log(`Applying ${fileName}...`);

  const result = spawnSync("psql", [connectionString, "-v", "ON_ERROR_STOP=1", "-f", filePath], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || `Failed to apply ${fileName}`);
    process.exit(result.status ?? 1);
  }
}

console.log("Database migrations completed.");
