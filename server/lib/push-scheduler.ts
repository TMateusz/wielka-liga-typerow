import { abbreviateTeam } from "../../shared/team-abbrev.js";
import { canBetOnMatch } from "../../shared/scoring.js";
import { prisma } from "./prisma.js";
import { isPushConfigured, sendPushNotification } from "./web-push.js";

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 min
const REMINDER_HOURS_BEFORE = 2;

/**
 * Powiadomienie 1: "Mecz za 2h, nie masz typu na mecz (POL–GER)"
 * Wysyłane ~2h przed kickoff do graczy bez predykcji.
 */
async function sendMatchReminders(): Promise<number> {
  const now = new Date();
  const targetMs = REMINDER_HOURS_BEFORE * 60 * 60 * 1000;
  const toleranceMs = Math.max(POLL_INTERVAL_MS, 10 * 60 * 1000);

  const windowStart = new Date(now.getTime() + targetMs - toleranceMs);
  const windowEnd = new Date(now.getTime() + targetMs + toleranceMs);

  const matches = await prisma.match.findMany({
    where: {
      status: "PENDING",
      kickoffTime: { gte: windowStart, lte: windowEnd },
    },
    select: { id: true, homeTeam: true, awayTeam: true, kickoffTime: true },
  });

  let sent = 0;

  for (const match of matches) {
    if (!canBetOnMatch("PENDING", match.kickoffTime, now)) continue;

    const abbrev = `${abbreviateTeam(match.homeTeam)}–${abbreviateTeam(match.awayTeam)}`;

    // Find users with push subscriptions who have NO prediction for this match
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        user: {
          predictions: { none: { matchId: match.id } },
        },
      },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });

    for (const sub of subscriptions) {
      const success = await sendPushNotification(sub, {
        title: "⚽ Nie masz typu!",
        body: `Mecz za 2h, nie masz typu na mecz ${abbrev}`,
        url: "/dashboard",
        tag: `reminder-${match.id}`,
      });

      if (success) {
        sent++;
      } else {
        // Remove invalid subscription
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }

  return sent;
}

/**
 * Powiadomienie 2: "Zgarniasz 3/1 pkt za mecz (POL–GER)"
 * Wysyłane po zakończeniu meczu — tu obsługujemy to w match-service
 * (wywoływane z sync-service gdy mecz przechodzi z LIVE na FINISHED).
 */
export async function sendPointsNotification(
  matchId: string,
): Promise<number> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { homeTeam: true, awayTeam: true },
  });
  if (!match) return 0;

  const abbrev = `${abbreviateTeam(match.homeTeam)}–${abbreviateTeam(match.awayTeam)}`;

  // Find predictions with points > 0 for this match
  const predictions = await prisma.prediction.findMany({
    where: {
      matchId,
      pointsEarned: { gt: 0 },
    },
    select: {
      userId: true,
      pointsEarned: true,
    },
  });

  let sent = 0;

  for (const pred of predictions) {
    const pts = pred.pointsEarned!;
    const ptsLabel = Number.isInteger(pts) ? String(pts) : pts.toFixed(1);

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: pred.userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });

    for (const sub of subscriptions) {
      const success = await sendPushNotification(sub, {
        title: "🎉 Zdobywasz punkty!",
        body: `Zgarniasz ${ptsLabel} pkt za mecz ${abbrev}`,
        url: "/dashboard",
        tag: `points-${matchId}`,
      });

      if (success) {
        sent++;
      } else {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }

  return sent;
}

/**
 * Powiadomienie 3: "@Imię Cię oznaczył(a) na czacie"
 * Wysyłane natychmiast po wzmiance w wiadomości czatu.
 */
export async function sendMentionNotification(
  mentionedUserIds: string[],
  senderName: string,
): Promise<number> {
  if (!isPushConfigured() || mentionedUserIds.length === 0) return 0;

  let sent = 0;

  for (const userId of mentionedUserIds) {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });

    for (const sub of subscriptions) {
      const success = await sendPushNotification(sub, {
        title: "💬 Wzmianка na czacie",
        body: `${senderName} oznaczył(a) Cię na czacie`,
        url: "/dashboard",
        tag: `mention-${Date.now()}`,
      });

      if (success) {
        sent++;
      } else {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }

  return sent;
}

export function startPushScheduler() {
  if (!isPushConfigured()) {
    console.log("Push: brak VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY — powiadomienia wyłączone");
    return;
  }

  const run = async () => {
    try {
      const sent = await sendMatchReminders();
      if (sent > 0) {
        console.log(`[Push] Wysłano ${sent} przypomnień o typach`);
      }
    } catch (e) {
      console.error("[Push] Błąd:", e instanceof Error ? e.message : e);
    }
  };

  // Start after 45s to let the server boot
  setTimeout(run, 45_000);
  setInterval(run, POLL_INTERVAL_MS);

  console.log(`Push: przypomnienia 2h przed meczem, sprawdzanie co ${POLL_INTERVAL_MS / 60_000} min`);
}
