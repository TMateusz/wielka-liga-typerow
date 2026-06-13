import { Router } from "express";
import { UserRole } from "@prisma/client";
import { isApiFootballConfigured } from "../lib/api-football.js";
import { localizeMatch } from "../../shared/team-names.js";
import { isValidNickname, normalizeNickname } from "../../shared/user-display.js";
import { parseKnockoutSide } from "../../shared/knockout.js";
import { setMatchResult } from "../lib/match-service.js";
import { prisma } from "../lib/prisma.js";
import {
  getSyncStatus,
  importWorldCupFixtures,
  syncMatchResults,
} from "../lib/sync-service.js";
import {
  getWorldCup2026SyncStatus,
  syncWorldCup2026Live,
} from "../lib/worldcup2026-sync.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { adminSetVirtualBalance } from "../lib/virtual-token-rewards.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/sync/status", (_req, res) => {
  res.json({
    apiFootball: getSyncStatus(),
    worldCup2026: getWorldCup2026SyncStatus(),
  });
});

router.post("/sync/live", async (_req, res) => {
  try {
    const result = await syncWorldCup2026Live();
    res.json(result);
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Błąd synchronizacji live",
    });
  }
});

router.post("/sync/import", async (_req, res) => {
  try {
    const result = await importWorldCupFixtures();
    res.json(result);
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Błąd importu meczów",
    });
  }
});

router.post("/sync/now", async (_req, res) => {
  if (!isApiFootballConfigured()) {
    return res.status(400).json({ error: "Brak klucza API_FOOTBALL_KEY" });
  }

  try {
    const result = await syncMatchResults();
    res.json(result);
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Błąd synchronizacji",
    });
  }
});

router.get("/matches", async (_req, res) => {
  const [matches, playerCount] = await Promise.all([
    prisma.match.findMany({
      orderBy: { kickoffTime: "asc" },
      include: {
        _count: {
          select: {
            predictions: {
              where: { user: { role: UserRole.USER } },
            },
          },
        },
      },
    }),
    prisma.user.count({ where: { role: UserRole.USER } }),
  ]);

  res.json(
    matches.map((m) => ({
      ...localizeMatch({
        id: m.id,
        fixtureNumber: m.fixtureNumber,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        kickoffTime: m.kickoffTime.toISOString(),
        status: m.status,
        stage: m.stage,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        knockoutWinner: m.knockoutWinner,
      }),
      predictionCount: m._count.predictions,
      playerCount,
    }))
  );
});

router.post("/matches", async (req, res) => {
  const { homeTeam, awayTeam, kickoffTime, stage } = req.body;

  if (!homeTeam || !awayTeam || !kickoffTime) {
    return res.status(400).json({ error: "Uzupełnij wszystkie pola" });
  }

  const match = await prisma.match.create({
    data: {
      homeTeam: String(homeTeam),
      awayTeam: String(awayTeam),
      kickoffTime: new Date(kickoffTime),
      stage: stage ? String(stage) : null,
    },
  });

  res.json({ ...match, kickoffTime: match.kickoffTime.toISOString() });
});

router.patch("/matches/:id/teams", async (req, res) => {
  const { id } = req.params;
  const { homeTeam, awayTeam } = req.body;

  if (!homeTeam?.trim() || !awayTeam?.trim()) {
    return res.status(400).json({ error: "Podaj obie drużyny" });
  }

  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) {
    return res.status(404).json({ error: "Mecz nie istnieje" });
  }

  if (match.status === "FINISHED") {
    return res.status(409).json({ error: "Nie można zmienić drużyn po zakończeniu meczu" });
  }

  const updated = await prisma.match.update({
    where: { id },
    data: {
      homeTeam: String(homeTeam).trim(),
      awayTeam: String(awayTeam).trim(),
    },
  });

  res.json({ ...updated, kickoffTime: updated.kickoffTime.toISOString() });
});

router.post("/matches/:id/result", async (req, res) => {
  const { id } = req.params;
  const { homeScore, awayScore, knockoutWinner } = req.body;

  if (
    typeof homeScore !== "number" ||
    typeof awayScore !== "number" ||
    homeScore < 0 ||
    awayScore < 0
  ) {
    return res.status(400).json({ error: "Nieprawidłowy wynik" });
  }

  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) {
    return res.status(404).json({ error: "Mecz nie istnieje" });
  }

  const isCorrection = match.status === "FINISHED";

  try {
    await setMatchResult(
      id,
      homeScore,
      awayScore,
      parseKnockoutSide(knockoutWinner),
      req.user!.id
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nie udało się zapisać wyniku";
    return res.status(400).json({ error: message });
  }

  res.json({ success: true, corrected: isCorrection });
});

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  nickname: true,
  totalPoints: true,
  role: true,
  createdAt: true,
  virtualWallet: { select: { balance: true } },
  _count: { select: { predictions: true } },
} as const;

router.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: [
      { role: "asc" },
      { totalPoints: "desc" },
      { firstName: "asc" },
      { lastName: "asc" },
    ],
    select: userSelect,
  });

  res.json(
    users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
    }))
  );
});

router.patch("/users/:id", async (req, res) => {
  const { id } = req.params;
  const firstName = typeof req.body.firstName === "string" ? req.body.firstName.trim() : undefined;
  const lastName = typeof req.body.lastName === "string" ? req.body.lastName.trim() : undefined;
  const nicknameRaw =
    typeof req.body.nickname === "string" ? req.body.nickname.trim() : undefined;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: "Użytkownik nie istnieje" });
  }

  const data: { firstName?: string; lastName?: string; nickname?: string } = {};

  if (firstName !== undefined) {
    if (firstName.length < 2) {
      return res.status(400).json({ error: "Imię musi mieć co najmniej 2 znaki" });
    }
    data.firstName = firstName;
  }

  if (lastName !== undefined) {
    if (lastName.length < 2) {
      return res.status(400).json({ error: "Nazwisko musi mieć co najmniej 2 znaki" });
    }
    data.lastName = lastName;
  }

  if (nicknameRaw !== undefined) {
    if (!isValidNickname(nicknameRaw)) {
      return res.status(400).json({
        error: "Nick musi mieć 3–20 znaków (litery, cyfry, podkreślnik)",
      });
    }
    const nickname = normalizeNickname(nicknameRaw);
    if (nickname !== existing.nickname) {
      const taken = await prisma.user.findUnique({ where: { nickname } });
      if (taken) {
        return res.status(409).json({ error: "Ten nick jest już zajęty" });
      }
      data.nickname = nickname;
    }
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "Brak danych do aktualizacji" });
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: userSelect,
  });

  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

router.patch("/users/:id/wallet", async (req, res) => {
  const { id } = req.params;
  const balanceRaw = req.body.balance;

  if (typeof balanceRaw !== "number" || !Number.isFinite(balanceRaw)) {
    return res.status(400).json({ error: "Podaj liczbę całkowitą balance" });
  }

  const balance = Math.trunc(balanceRaw);

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: "Użytkownik nie istnieje" });
  }

  try {
    const result = await adminSetVirtualBalance(id, balance);
    res.json(result);
  } catch (e) {
    res.status(400).json({
      error: e instanceof Error ? e.message : "Nie udało się zaktualizować salda punktów",
    });
  }
});

router.get("/result-history", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);

  const rows = await prisma.matchResultHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      match: {
        select: {
          homeTeam: true,
          awayTeam: true,
          stage: true,
          fixtureNumber: true,
        },
      },
      admin: {
        select: {
          nickname: true,
          firstName: true,
        },
      },
    },
  });

  res.json(
    rows.map((row) => {
      const match = localizeMatch(row.match);
      return {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        adminNickname: row.admin.nickname,
        adminName: row.admin.firstName,
        match: {
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          stage: match.stage,
          fixtureNumber: row.match.fixtureNumber,
        },
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        knockoutWinner: row.knockoutWinner,
        previousHomeScore: row.previousHomeScore,
        previousAwayScore: row.previousAwayScore,
        previousKnockoutWinner: row.previousKnockoutWinner,
        isCorrection: row.previousHomeScore != null || row.previousAwayScore != null,
      };
    })
  );
});

router.delete("/users/:id", async (req, res) => {
  const { id } = req.params;

  if (id === req.user!.id) {
    return res.status(403).json({ error: "Nie możesz usunąć własnego konta" });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: "Użytkownik nie istnieje" });
  }

  if (existing.role === UserRole.ADMIN) {
    return res.status(403).json({ error: "Nie można usunąć konta administratora" });
  }

  await prisma.user.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
