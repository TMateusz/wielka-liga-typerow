import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { getVapidPublicKey, isPushConfigured } from "../lib/web-push.js";

const router = Router();

router.get("/vapid-key", (_req, res) => {
  if (!isPushConfigured()) {
    return res.status(503).json({ error: "Push nie jest skonfigurowany" });
  }
  res.json({ key: getVapidPublicKey() });
});

router.post("/subscribe", requireAuth, async (req, res) => {
  if (!isPushConfigured()) {
    return res.status(503).json({ error: "Push nie jest skonfigurowany" });
  }

  const { endpoint, keys } = req.body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Brak danych subskrypcji" });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: req.user!.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    update: {
      userId: req.user!.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  });

  res.json({ ok: true });
});

router.post("/unsubscribe", requireAuth, async (req, res) => {
  const { endpoint } = req.body as { endpoint?: string };

  if (!endpoint) {
    return res.status(400).json({ error: "Brak endpoint" });
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: req.user!.id },
  });

  res.json({ ok: true });
});

router.get("/preferences", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { pushPreferences: true },
  });
  res.json({ preferences: user?.pushPreferences ?? null });
});

router.patch("/preferences", requireAuth, async (req, res) => {
  const { preferences } = req.body as { preferences?: Record<string, boolean> };
  if (!preferences || typeof preferences !== "object") {
    return res.status(400).json({ error: "Brak preferencji" });
  }

  await prisma.user.update({
    where: { id: req.user!.id },
    data: { pushPreferences: JSON.stringify(preferences) },
  });

  res.json({ ok: true });
});

export default router;
