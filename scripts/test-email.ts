/**
 * Test konfiguracji SMTP i wysyłki przypomnienia.
 *
 * Dry-run (bez SMTP):
 *   EMAIL_REMINDERS_DRY_RUN=true npx tsx scripts/test-email.ts
 *
 * Prawdziwy mail:
 *   npx tsx --env-file=.env scripts/test-email.ts twoj@email.pl
 */
import {
  buildBetReminderEmail,
  getEmailFrom,
  isEmailConfigured,
  sendEmail,
} from "../server/lib/email.js";
import nodemailer from "nodemailer";

const to = process.argv[2]?.trim() || process.env.TEST_EMAIL?.trim();
const dryRun = process.env.EMAIL_REMINDERS_DRY_RUN === "true";

async function verifySmtp() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!host || !user || !pass) {
    throw new Error("Brak SMTP_HOST, SMTP_USER lub SMTP_PASS w .env");
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transport.verify();
  console.log(`  ✓ Połączenie SMTP OK (${host}:${port}, użytkownik: ${user})`);
}

async function main() {
  console.log("\n=== Test e-maili — Wielka Liga Typerów ===\n");

  console.log(`Tryb: ${dryRun ? "dry-run (tylko log)" : "wysyłka prawdziwa"}`);
  console.log(`Nadawca: ${getEmailFrom()}`);
  console.log(`APP_URL: ${process.env.APP_URL ?? "(domyślny localhost)"}`);

  if (!dryRun) {
    if (!to) {
      throw new Error("Podaj adres: npx tsx scripts/test-email.ts twoj@email.pl");
    }
    if (!isEmailConfigured()) {
      throw new Error("Uzupełnij SMTP_HOST, SMTP_USER, SMTP_PASS w .env");
    }
    await verifySmtp();
  } else if (!to) {
    console.log("Dry-run: używam test@example.com");
  }

  const recipient = to || "test@example.com";
  const sample = buildBetReminderEmail({
    firstName: "Test",
    nickname: "tester",
    homeTeam: "Meksyk",
    awayTeam: "RPA",
    stage: "Grupa A",
    kickoffTime: new Date("2026-06-11T19:00:00.000Z"),
  });

  await sendEmail({
    to: recipient,
    subject: `[TEST] ${sample.subject}`,
    text: sample.text,
    html: sample.html,
  });

  if (dryRun) {
    console.log("\n=== Dry-run zakończony — sprawdź log powyżej ===\n");
  } else {
    console.log(`\n=== Wysłano testowy mail na ${recipient} ===`);
    console.log("Sprawdź skrzynkę (i folder SPAM).\n");
  }
}

main().catch((e) => {
  console.error("\n✗ Test e-maili nie przeszedł:\n", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
