import type { Request } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "./prisma.js";

function envInt(name: string, fallback = 0): number {
  const raw = process.env[name];
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getRegistrationCode(): string | null {
  const code = process.env.REGISTRATION_CODE?.trim();
  return code || null;
}

export function getMaxPlayers(): number {
  return envInt("MAX_PLAYERS", 0);
}

export function getMaxAccountsPerIp(): number {
  return envInt("MAX_ACCOUNTS_PER_IP", 0);
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.socket.remoteAddress ?? "unknown";
}

export async function getRegistrationStatus() {
  const [playerCount, maxPlayers] = await Promise.all([
    prisma.user.count({ where: { role: UserRole.USER } }),
    Promise.resolve(getMaxPlayers()),
  ]);

  const slotsLeft = maxPlayers > 0 ? Math.max(0, maxPlayers - playerCount) : null;

  return {
    requiresCode: Boolean(getRegistrationCode()),
    maxPlayers: maxPlayers > 0 ? maxPlayers : null,
    playerCount,
    slotsLeft,
    open: maxPlayers === 0 || playerCount < maxPlayers,
  };
}

export function validateInviteCode(provided: unknown): string | null {
  const required = getRegistrationCode();
  if (!required) return null;

  const code = typeof provided === "string" ? provided.trim() : "";
  if (!code) return "Podaj kod zaproszenia";
  if (code.toLowerCase() !== required.toLowerCase()) return "Nieprawidłowy kod zaproszenia";
  return null;
}

export async function validateRegistrationLimits(ip: string): Promise<string | null> {
  const maxPlayers = getMaxPlayers();
  const maxPerIp = getMaxAccountsPerIp();

  if (maxPlayers > 0) {
    const playerCount = await prisma.user.count({ where: { role: UserRole.USER } });
    if (playerCount >= maxPlayers) {
      return "Rejestracja zamknięta — osiągnięto limit graczy";
    }
  }

  if (maxPerIp > 0 && ip !== "unknown") {
    const ipCount = await prisma.user.count({
      where: { role: UserRole.USER, registrationIp: ip },
    });
    if (ipCount >= maxPerIp) {
      return `Z tego adresu można założyć max. ${maxPerIp} ${
        maxPerIp === 1 ? "konto" : "konta"
      }`;
    }
  }

  return null;
}
