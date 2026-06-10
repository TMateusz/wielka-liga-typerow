import { canBetOnMatch } from "../../shared/scoring.js";
import { buildBetReminderEmail, isEmailConfigured, sendEmail } from "./email.js";
import { prisma } from "./prisma.js";

const DEFAULT_HOURS_BEFORE = 8;
const DEFAULT_POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 min

function envHoursBefore(): number {
  const value = Number(process.env.EMAIL_REMINDER_HOURS_BEFORE);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_HOURS_BEFORE;
}

function envPollIntervalMs(): number {
  const value = Number(process.env.EMAIL_REMINDER_POLL_INTERVAL_MS);
  return Number.isFinite(value) && value >= 60_000 ? value : DEFAULT_POLL_INTERVAL_MS;
}

export async function runBetReminderJob(): Promise<{ matches: number; sent: number }> {
  const hoursBefore = envHoursBefore();
  const pollMs = envPollIntervalMs();
  const now = new Date();
  const targetMs = hoursBefore * 60 * 60 * 1000;
  const toleranceMs = Math.max(pollMs / 2, 5 * 60 * 1000);

  const windowStart = new Date(now.getTime() + targetMs - toleranceMs);
  const windowEnd = new Date(now.getTime() + targetMs + toleranceMs);

  const matches = await prisma.match.findMany({
    where: {
      status: "PENDING",
      kickoffTime: { gte: windowStart, lte: windowEnd },
    },
    select: {
      id: true,
      homeTeam: true,
      awayTeam: true,
      kickoffTime: true,
      stage: true,
    },
  });

  let sent = 0;

  for (const match of matches) {
    if (!canBetOnMatch("PENDING", match.kickoffTime, now)) continue;

    const users = await prisma.user.findMany({
      where: {
        role: "USER",
        email: { not: null },
        emailRemindersEnabled: true,
        predictions: { none: { matchId: match.id } },
        matchRemindersSent: { none: { matchId: match.id } },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        nickname: true,
      },
    });

    for (const user of users) {
      if (!user.email) continue;

      const stillNoBet = !(await prisma.prediction.findUnique({
        where: { userId_matchId: { userId: user.id, matchId: match.id } },
        select: { id: true },
      }));

      if (!stillNoBet) continue;

      const content = buildBetReminderEmail({
        firstName: user.firstName,
        nickname: user.nickname,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        stage: match.stage,
        kickoffTime: match.kickoffTime,
      });

      try {
        await sendEmail({
          to: user.email,
          ...content,
        });

        await prisma.matchReminderSent.create({
          data: { userId: user.id, matchId: match.id },
        });

        sent += 1;
      } catch (e) {
        console.error(
          `[Przypomnienia] Błąd wysyłki do ${user.nickname} (${match.homeTeam}–${match.awayTeam}):`,
          e instanceof Error ? e.message : e
        );
      }
    }
  }

  return { matches: matches.length, sent };
}

export function startReminderScheduler() {
  if (process.env.EMAIL_REMINDERS_ENABLED === "false") {
    console.log("Przypomnienia e-mail wyłączone (EMAIL_REMINDERS_ENABLED=false)");
    return;
  }

  const dryRun = process.env.EMAIL_REMINDERS_DRY_RUN === "true";

  if (!dryRun && !isEmailConfigured()) {
    console.log(
      "Przypomnienia e-mail: brak SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS) — pominięto"
    );
    return;
  }

  const hoursBefore = envHoursBefore();
  const pollMs = envPollIntervalMs();

  const run = async () => {
    try {
      const result = await runBetReminderJob();
      if (result.sent > 0) {
        console.log(
          `[Przypomnienia] Wysłano ${result.sent} e-mail(i) (${result.matches} mecz(y) w oknie ${hoursBefore}h)`
        );
      }
    } catch (e) {
      console.error("[Przypomnienia] Błąd:", e instanceof Error ? e.message : e);
    }
  };

  setTimeout(run, 30_000);
  setInterval(run, pollMs);

  const mode = dryRun ? " (dry-run)" : "";
  console.log(
    `Przypomnienia e-mail: ${hoursBefore}h przed meczem, sprawdzanie co ${pollMs / 60_000} min${mode}`
  );
}
