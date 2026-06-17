import { abbreviateTeam } from "../../shared/team-abbrev.js";
import { canBetOnMatch } from "../../shared/scoring.js";
import { parsePushPreferences, type PushCategory } from "../../shared/push-preferences.js";
import { prisma } from "./prisma.js";
import { isPushConfigured, sendPushNotification } from "./web-push.js";

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 min
const REMINDER_HOURS_BEFORE = 2;

/** Helper: send to all user's subscriptions, remove invalid ones. Returns count sent. */
async function sendToUser(
  userId: string,
  category: PushCategory,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<number> {
  if (!isPushConfigured()) return 0;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushPreferences: true },
  });
  const prefs = parsePushPreferences(user?.pushPreferences);
  if (!prefs[category]) return 0;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  let sent = 0;
  for (const sub of subscriptions) {
    const success = await sendPushNotification(sub, payload);
    if (success) {
      sent++;
    } else {
      await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
    }
  }
  return sent;
}

// ─── 1. BRAK TYPU (2h przed meczem) ────────────────────────────────────────

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

    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        user: { predictions: { none: { matchId: match.id } } },
      },
      select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true },
    });

    for (const sub of subscriptions) {
      const user = await prisma.user.findUnique({
        where: { id: sub.userId },
        select: { pushPreferences: true },
      });
      const prefs = parsePushPreferences(user?.pushPreferences);
      if (!prefs.missingBet) continue;

      const success = await sendPushNotification(sub, {
        title: "⚽ Nie masz typu!",
        body: `Mecz za 2h, nie masz typu na mecz ${abbrev}`,
        url: "/dashboard",
        tag: `reminder-${match.id}`,
      });

      if (success) sent++;
      else await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
    }
  }

  return sent;
}

// ─── 2. ZDOBYTE PUNKTY (po meczu) ──────────────────────────────────────────

export async function sendPointsNotification(matchId: string): Promise<number> {
  if (!isPushConfigured()) return 0;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { homeTeam: true, awayTeam: true },
  });
  if (!match) return 0;

  const abbrev = `${abbreviateTeam(match.homeTeam)}–${abbreviateTeam(match.awayTeam)}`;

  const predictions = await prisma.prediction.findMany({
    where: { matchId, pointsEarned: { gt: 0 } },
    select: { userId: true, pointsEarned: true },
  });

  let sent = 0;
  for (const pred of predictions) {
    const pts = pred.pointsEarned!;
    const ptsLabel = Number.isInteger(pts) ? String(pts) : pts.toFixed(1);

    sent += await sendToUser(pred.userId, "pointsEarned", {
      title: "🎉 Zdobywasz punkty!",
      body: `Zgarniasz ${ptsLabel} pkt za mecz ${abbrev}`,
      url: "/dashboard",
      tag: `points-${matchId}`,
    });
  }

  return sent;
}

// ─── 3. WZMIANKA NA CZACIE ──────────────────────────────────────────────────

export async function sendMentionNotification(
  mentionedUserIds: string[],
  senderName: string,
): Promise<number> {
  if (!isPushConfigured() || mentionedUserIds.length === 0) return 0;

  let sent = 0;
  for (const userId of mentionedUserIds) {
    sent += await sendToUser(userId, "mention", {
      title: "💬 Wzmianka na czacie",
      body: `${senderName} oznaczył(a) Cię na czacie`,
      url: "/dashboard",
      tag: `mention-${Date.now()}`,
    });
  }
  return sent;
}

// ─── 4. ODPOWIEDŹ NA CZACIE ────────────────────────────────────────────────

export async function sendReplyNotification(
  parentAuthorId: string,
  senderName: string,
  previewText: string,
): Promise<number> {
  if (!isPushConfigured()) return 0;

  const preview = previewText.length > 60 ? previewText.slice(0, 57) + "…" : previewText;

  return sendToUser(parentAuthorId, "reply", {
    title: "↩️ Odpowiedź na czacie",
    body: `${senderName}: ${preview}`,
    url: "/dashboard",
    tag: `reply-${Date.now()}`,
  });
}

// ─── 5. LIVE: MECZ SIĘ ZACZĄŁ ──────────────────────────────────────────────

export async function sendMatchStartedNotification(matchId: string): Promise<number> {
  if (!isPushConfigured()) return 0;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { homeTeam: true, awayTeam: true },
  });
  if (!match) return 0;

  const abbrev = `${abbreviateTeam(match.homeTeam)}–${abbreviateTeam(match.awayTeam)}`;

  // Send to all users with subscriptions who have this category enabled
  const allSubs = await prisma.pushSubscription.findMany({
    select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true },
  });

  let sent = 0;
  const checked = new Set<string>();

  for (const sub of allSubs) {
    if (checked.has(sub.userId)) continue;
    checked.add(sub.userId);

    const user = await prisma.user.findUnique({
      where: { id: sub.userId },
      select: { pushPreferences: true },
    });
    const prefs = parsePushPreferences(user?.pushPreferences);
    if (!prefs.matchStarted) continue;

    // Send to all subs of this user
    const userSubs = allSubs.filter((s) => s.userId === sub.userId);
    for (const uSub of userSubs) {
      const success = await sendPushNotification(uSub, {
        title: "🟢 Mecz się zaczął!",
        body: `${match.homeTeam} vs ${match.awayTeam} — gwizdek!`,
        url: "/dashboard",
        tag: `start-${matchId}`,
      });
      if (success) sent++;
      else await prisma.pushSubscription.delete({ where: { id: uSub.id } }).catch(() => {});
    }
  }

  return sent;
}

// ─── 6. LIVE: MECZ SIĘ SKOŃCZYŁ ────────────────────────────────────────────

export async function sendMatchFinishedNotification(
  matchId: string,
  homeScore: number,
  awayScore: number,
): Promise<number> {
  if (!isPushConfigured()) return 0;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { homeTeam: true, awayTeam: true },
  });
  if (!match) return 0;

  const abbrev = `${abbreviateTeam(match.homeTeam)}–${abbreviateTeam(match.awayTeam)}`;

  const allSubs = await prisma.pushSubscription.findMany({
    select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true },
  });

  let sent = 0;
  const checked = new Set<string>();

  for (const sub of allSubs) {
    if (checked.has(sub.userId)) continue;
    checked.add(sub.userId);

    const user = await prisma.user.findUnique({
      where: { id: sub.userId },
      select: { pushPreferences: true },
    });
    const prefs = parsePushPreferences(user?.pushPreferences);
    if (!prefs.matchFinished) continue;

    const userSubs = allSubs.filter((s) => s.userId === sub.userId);
    for (const uSub of userSubs) {
      const success = await sendPushNotification(uSub, {
        title: "🏁 Koniec meczu!",
        body: `${abbrev} — wynik końcowy ${homeScore}:${awayScore}`,
        url: "/dashboard",
        tag: `finished-${matchId}`,
      });
      if (success) sent++;
      else await prisma.pushSubscription.delete({ where: { id: uSub.id } }).catch(() => {});
    }
  }

  return sent;
}

// ─── 7. LIVE: GOL ───────────────────────────────────────────────────────────

export async function sendGoalNotification(
  matchId: string,
  homeScore: number,
  awayScore: number,
): Promise<number> {
  if (!isPushConfigured()) return 0;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { homeTeam: true, awayTeam: true },
  });
  if (!match) return 0;

  const abbrev = `${abbreviateTeam(match.homeTeam)}–${abbreviateTeam(match.awayTeam)}`;

  // Get predictions for this match so we can show +Xpkt to each user
  const predictions = await prisma.prediction.findMany({
    where: { matchId },
    select: { userId: true, pointsEarned: true },
  });
  const ptsMap = new Map(predictions.map((p) => [p.userId, p.pointsEarned]));

  const allSubs = await prisma.pushSubscription.findMany({
    select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true },
  });

  let sent = 0;
  const checked = new Set<string>();

  for (const sub of allSubs) {
    if (checked.has(sub.userId)) continue;
    checked.add(sub.userId);

    const user = await prisma.user.findUnique({
      where: { id: sub.userId },
      select: { pushPreferences: true },
    });
    const prefs = parsePushPreferences(user?.pushPreferences);
    if (!prefs.goal) continue;

    const pts = ptsMap.get(sub.userId);
    const ptsStr = pts != null && pts > 0
      ? ` (+${Number.isInteger(pts) ? pts : pts.toFixed(1)} pkt)`
      : "";

    const userSubs = allSubs.filter((s) => s.userId === sub.userId);
    for (const uSub of userSubs) {
      const success = await sendPushNotification(uSub, {
        title: "⚽ Gol!",
        body: `${abbrev} ${homeScore}:${awayScore}${ptsStr}`,
        url: "/dashboard",
        tag: `goal-${matchId}`,
      });
      if (success) sent++;
      else await prisma.pushSubscription.delete({ where: { id: uSub.id } }).catch(() => {});
    }
  }

  return sent;
}

// ─── SCHEDULER ──────────────────────────────────────────────────────────────

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

  setTimeout(run, 45_000);
  setInterval(run, POLL_INTERVAL_MS);

  console.log(`Push: przypomnienia 2h przed meczem, sprawdzanie co ${POLL_INTERVAL_MS / 60_000} min`);
}
