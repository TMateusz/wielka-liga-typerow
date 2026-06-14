import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getSimulatorState, placeVirtualBet } from "../lib/virtual-betting-service.js";
import { prisma } from "../lib/prisma.js";
import type { VirtualBetSelection } from "../../shared/simulator.js";

const router = Router();

router.use(requireAuth);

async function userHasAcceptedTerms(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hasAcceptedSimulatorTerms: true },
  });
  return user?.hasAcceptedSimulatorTerms ?? false;
}

router.get("/", async (req, res) => {
  const accepted = await userHasAcceptedTerms(req.user!.id);
  if (!accepted) {
    // Check if user already has 2+ bets — if so, auto-accept
    const betCount = await prisma.virtualBet.count({ where: { userId: req.user!.id } });
    if (betCount >= 2) {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { hasAcceptedSimulatorTerms: true },
      });
      const state = await getSimulatorState(req.user!.id);
      res.json({ ...state, hasAcceptedSimulatorTerms: true });
      return;
    }
    res.json({ hasAcceptedSimulatorTerms: false });
    return;
  }

  const state = await getSimulatorState(req.user!.id);
  res.json({ ...state, hasAcceptedSimulatorTerms: true });
});

router.post("/accept-terms", async (req, res) => {
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { hasAcceptedSimulatorTerms: true },
  });

  const state = await getSimulatorState(req.user!.id);
  res.json({ ...state, hasAcceptedSimulatorTerms: true });
});

router.post("/bets", async (req, res) => {
  if (!(await userHasAcceptedTerms(req.user!.id))) {
    res.status(403).json({ error: "Musisz zaakceptować regulamin gry towarzyskiej" });
    return;
  }

  const { matchId, selection, stake } = req.body as {
    matchId?: string;
    selection?: VirtualBetSelection;
    stake?: number;
  };

  if (!matchId || !selection || stake == null) {
    res.status(400).json({ error: "Podaj matchId, selection i stake" });
    return;
  }

  if (selection !== "HOME" && selection !== "DRAW" && selection !== "AWAY") {
    res.status(400).json({ error: "Nieprawidłowy typ bonusowy" });
    return;
  }

  try {
    const bet = await placeVirtualBet({
      userId: req.user!.id,
      matchId,
      selection,
      stake: Number(stake),
    });
    const state = await getSimulatorState(req.user!.id);
    res.json({ bet, ...state });
  } catch (e) {
    res.status(400).json({
      error: e instanceof Error ? e.message : "Nie udało się zapisać typu bonusowego",
    });
  }
});

export default router;
