/**
 * Uruchamia wszystkie testy punktacji (jednostkowe + symulacje DB).
 * Uruchom: npm run test:points
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function ensureDb(url: string) {
  const result = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], {
    cwd: root,
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url },
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(result.stderr?.toString() ?? "db push failed");
    process.exit(1);
  }
}

ensureDb("file:./data/sim-live-test.db");
ensureDb("file:./data/sim-ko-test.db");

const steps = [
  { name: "Testy jednostkowe", cmd: "npx", args: ["tsx", "scripts/test-scoring.ts"] },
  {
    name: "Symulacja live (grupa)",
    cmd: "npx",
    args: ["tsx", "scripts/simulate-live-scoring.ts"],
    env: { DATABASE_URL: "file:./data/sim-live-test.db" },
  },
  {
    name: "Symulacja pucharowa",
    cmd: "npx",
    args: ["tsx", "scripts/simulate-knockout-scoring.ts"],
    env: { DATABASE_URL: "file:./data/sim-ko-test.db" },
  },
];

console.log("\n╔══════════════════════════════════════╗");
console.log("║  Pełny pakiet testów punktacji       ║");
console.log("╚══════════════════════════════════════╝");

let failed = 0;

for (const step of steps) {
  console.log(`\n── ${step.name} ──\n`);
  const result = spawnSync(step.cmd, step.args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...step.env },
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(`\n✗ ${step.name} — FAILED\n`);
    failed++;
  }
}

console.log("\n══════════════════════════════════════");
if (failed === 0) {
  console.log("✓ Wszystkie testy punktacji przeszły pomyślnie");
} else {
  console.log(`✗ ${failed} zestaw(ów) testów nie przeszło`);
  process.exitCode = 1;
}
console.log("══════════════════════════════════════\n");
