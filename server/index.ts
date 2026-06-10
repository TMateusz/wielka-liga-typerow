import express from "express";
import cors from "cors";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import matchesRoutes from "./routes/matches.js";
import predictionsRoutes from "./routes/predictions.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import adminRoutes from "./routes/admin.js";
import { ensureSeeded } from "./lib/ensure-seeded.js";
import { tuneSqlite } from "./lib/sqlite-tuning.js";
import { startReminderScheduler } from "./lib/reminder-scheduler.js";
import { startSyncScheduler } from "./lib/sync-scheduler.js";

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

async function start() {
  await tuneSqlite();
  await ensureSeeded();

  app.listen(PORT, () => {
    console.log(`Serwer API działa na porcie ${PORT}`);
    startSyncScheduler();
    startReminderScheduler();
  });
}

start().catch((err) => {
  console.error("Nie udało się uruchomić serwera:", err);
  process.exit(1);
});
