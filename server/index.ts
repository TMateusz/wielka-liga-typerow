import express from "express";
import cors from "cors";
import { execSync } from "node:child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import matchesRoutes from "./routes/matches.js";
import predictionsRoutes from "./routes/predictions.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import adminRoutes from "./routes/admin.js";
import chatRoutes from "./routes/chat.js";
import calendarRoutes from "./routes/calendar.js";
import simulatorRoutes from "./routes/simulator.js";
import pushRoutes from "./routes/push.js";
import { ensureSeeded } from "./lib/ensure-seeded.js";
import { tuneSqlite } from "./lib/sqlite-tuning.js";
import { startReminderScheduler } from "./lib/reminder-scheduler.js";
import { startLiveSyncScheduler } from "./lib/live-sync-scheduler.js";
import { startSimulatorOddsScheduler } from "./lib/simulator-odds-scheduler.js";
import { startPushScheduler } from "./lib/push-scheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const isProd = process.env.NODE_ENV === "production";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/matches", matchesRoutes);
app.use("/api/predictions", predictionsRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/simulator", simulatorRoutes);
app.use("/api/push", pushRoutes);

const clientDir = path.join(__dirname, "../client");
const clientIndex = path.join(clientDir, "index.html");

if (existsSync(clientIndex)) {
  app.use(express.static(clientDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(clientIndex);
  });
} else if (isProd) {
  console.warn("Brak buildu frontendu — uruchom: npm run build");
  app.get("/", (_req, res) => {
    res.status(503).json({
      error: "Frontend nie zbudowany. Uruchom: npm run build",
    });
  });
}

async function syncDatabaseSchema() {
  try {
    execSync("npx prisma db push --skip-generate", {
      stdio: "inherit",
      env: process.env,
    });
  } catch (err) {
    console.error("Nie udało się zsynchronizować schematu bazy:", err);
    throw err;
  }
}

async function start() {
  await syncDatabaseSchema();
  await tuneSqlite();
  await ensureSeeded();

  app.listen(PORT, () => {
    console.log(`Serwer API działa na porcie ${PORT}`);
    startLiveSyncScheduler();
    startSimulatorOddsScheduler();
    startReminderScheduler();
    startPushScheduler();
  });
}

start().catch((err) => {
  console.error("Nie udało się uruchomić serwera:", err);
  process.exit(1);
});
