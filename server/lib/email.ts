import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getSmtpPort(): number {
  return Number(process.env.SMTP_PORT) || 587;
}

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!.trim(),
      port: getSmtpPort(),
      secure: getSmtpPort() === 465,
      auth: {
        user: process.env.SMTP_USER!.trim(),
        pass: process.env.SMTP_PASS!.trim(),
      },
    });
  }
  return transporter;
}

export function getAppBaseUrl(): string {
  const url = process.env.APP_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  return "http://localhost:5173";
}

export function getEmailFrom(): string {
  return (
    process.env.SMTP_FROM?.trim() ||
    "Wielka Liga Typerów <noreply@localhost>"
  );
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  if (process.env.EMAIL_REMINDERS_DRY_RUN === "true") {
    console.log(`[Email dry-run] Do: ${input.to} | ${input.subject}`);
    console.log(input.text);
    return;
  }

  await getTransporter().sendMail({
    from: getEmailFrom(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

export function formatMatchKickoff(kickoffTime: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(kickoffTime);
}

export function buildBetReminderEmail(input: {
  firstName: string;
  nickname: string;
  homeTeam: string;
  awayTeam: string;
  stage: string | null;
  kickoffTime: Date;
}): { subject: string; text: string; html: string } {
  const greeting = input.firstName.trim() || input.nickname;
  const matchLabel = `${input.homeTeam} – ${input.awayTeam}`;
  const kickoff = formatMatchKickoff(input.kickoffTime);
  const stagePart = input.stage ? ` (${input.stage})` : "";
  const dashboardUrl = `${getAppBaseUrl()}/dashboard`;

  const subject = `⏰ Typuj mecz za ~8h — ${input.homeTeam} vs ${input.awayTeam}`;

  const text = [
    `Cześć ${greeting}!`,
    "",
    `Za około 8 godzin rozpocznie się mecz ${matchLabel}${stagePart}.`,
    `Start: ${kickoff}.`,
    "",
    "Nie masz jeszcze typu na ten mecz — wejdź na ligę i obstaw wynik:",
    dashboardUrl,
    "",
    "— Wielka Liga Typerów · MŚ 2026",
    "",
    "Przypomnienia możesz wyłączyć w ustawieniach konta.",
  ].join("\n");

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 520px; color: #1a1a1a;">
      <p>Cześć <strong>${escapeHtml(greeting)}</strong>!</p>
      <p>Za około <strong>8 godzin</strong> rozpocznie się mecz:</p>
      <p style="font-size: 18px; font-weight: 600;">${escapeHtml(matchLabel)}${escapeHtml(stagePart)}</p>
      <p style="color: #555;">Start: ${escapeHtml(kickoff)}</p>
      <p>Nie masz jeszcze typu na ten mecz.</p>
      <p>
        <a href="${escapeHtml(dashboardUrl)}" style="display: inline-block; padding: 12px 20px; background: #c9a227; color: #0a1628; font-weight: 600; text-decoration: none; border-radius: 8px;">
          Obstaw wynik →
        </a>
      </p>
      <p style="font-size: 12px; color: #888; margin-top: 24px;">
        Wielka Liga Typerów · MŚ 2026<br>
        Przypomnienia wyłączysz w ustawieniach konta.
      </p>
    </div>
  `.trim();

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
