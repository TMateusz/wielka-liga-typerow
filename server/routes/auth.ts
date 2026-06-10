import { Router } from "express";
import bcrypt from "bcryptjs";
import { isValidEmail, normalizeEmail } from "../../shared/email.js";
import { isValidNickname, normalizeNickname } from "../../shared/user-display.js";
import { prisma } from "../lib/prisma.js";
import { rateLimit } from "../lib/rate-limit.js";
import {
  getClientIp,
  getRegistrationStatus,
  validateInviteCode,
  validateRegistrationLimits,
} from "../lib/registration-policy.js";
import { touchUserActivity } from "../lib/user-activity.js";
import { requireAuth, signToken, toAuthUser } from "../middleware/auth.js";

const router = Router();

const registerLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: "Zbyt wiele prób rejestracji — spróbuj za chwilę",
});

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Zbyt wiele prób logowania — spróbuj za chwilę",
});

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  nickname: true,
  email: true,
  emailRemindersEnabled: true,
  role: true,
  totalPoints: true,
} as const;

function validateRegistration(body: Record<string, unknown>) {
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const nicknameRaw = typeof body.nickname === "string" ? body.nickname.trim() : "";
  const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (firstName.length < 2 || lastName.length < 2) {
    return { error: "Imię i nazwisko muszą mieć co najmniej 2 znaki" };
  }

  if (!isValidEmail(emailRaw)) {
    return { error: "Podaj prawidłowy adres e-mail" };
  }

  if (!isValidNickname(nicknameRaw)) {
    return {
      error: "Nick musi mieć 3–20 znaków (litery, cyfry, podkreślnik)",
    };
  }

  if (password.length < 4) {
    return { error: "Hasło musi mieć co najmniej 4 znaki" };
  }

  return {
    data: {
      firstName,
      lastName,
      nickname: normalizeNickname(nicknameRaw),
      email: normalizeEmail(emailRaw),
      password,
    },
  };
}

router.get("/registration-info", async (_req, res) => {
  res.json(await getRegistrationStatus());
});

router.post("/register", registerLimit, async (req, res) => {
  const inviteError = validateInviteCode(req.body.inviteCode);
  if (inviteError) {
    return res.status(403).json({ error: inviteError });
  }

  const ip = getClientIp(req);
  const limitError = await validateRegistrationLimits(ip);
  if (limitError) {
    return res.status(403).json({ error: limitError });
  }

  const validated = validateRegistration(req.body);
  if ("error" in validated) {
    return res.status(400).json({ error: validated.error });
  }

  const { firstName, lastName, nickname, email, password } = validated.data;

  const existing = await prisma.user.findUnique({ where: { nickname } });
  if (existing) {
    return res.status(409).json({ error: "Ten nick jest już zajęty" });
  }

  const emailTaken = await prisma.user.findUnique({ where: { email } });
  if (emailTaken) {
    return res.status(409).json({ error: "Ten adres e-mail jest już zajęty" });
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      nickname,
      email,
      password: hashed,
      registrationIp: ip === "unknown" ? null : ip,
    },
    select: userSelect,
  });

  await touchUserActivity(user.id);

  const payload = toAuthUser(user);
  res.status(201).json({ token: signToken(payload), user: payload });
});

router.post("/login", loginLimit, async (req, res) => {
  const nicknameRaw = typeof req.body.nickname === "string" ? req.body.nickname : req.body.username;
  const { password } = req.body;

  if (!nicknameRaw || !password) {
    return res.status(400).json({ error: "Podaj nick i hasło" });
  }

  const nickname = normalizeNickname(nicknameRaw);
  const user = await prisma.user.findUnique({ where: { nickname } });
  if (!user) {
    return res.status(401).json({ error: "Nieprawidłowy nick lub hasło" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: "Nieprawidłowy nick lub hasło" });
  }

  await touchUserActivity(user.id);

  const payload = toAuthUser(user);
  res.json({ token: signToken(payload), user: payload });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: userSelect,
  });

  if (!user) {
    return res.status(404).json({ error: "Użytkownik nie istnieje" });
  }

  await touchUserActivity(user.id);
  res.json(user);
});

router.patch("/profile", requireAuth, async (req, res) => {
  const emailRaw = typeof req.body.email === "string" ? req.body.email.trim() : undefined;
  const remindersRaw = req.body.emailRemindersEnabled;

  const data: { email?: string; emailRemindersEnabled?: boolean } = {};

  if (emailRaw !== undefined) {
    if (!isValidEmail(emailRaw)) {
      return res.status(400).json({ error: "Podaj prawidłowy adres e-mail" });
    }
    const email = normalizeEmail(emailRaw);
    const taken = await prisma.user.findFirst({
      where: { email, NOT: { id: req.user!.id } },
      select: { id: true },
    });
    if (taken) {
      return res.status(409).json({ error: "Ten adres e-mail jest już zajęty" });
    }
    data.email = email;
  }

  if (typeof remindersRaw === "boolean") {
    data.emailRemindersEnabled = remindersRaw;
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "Brak danych do zapisania" });
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data,
    select: userSelect,
  });

  res.json(user);
});

router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Podaj obecne i nowe hasło" });
  }

  if (typeof newPassword !== "string" || newPassword.length < 4) {
    return res.status(400).json({ error: "Nowe hasło musi mieć co najmniej 4 znaki" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    return res.status(404).json({ error: "Użytkownik nie istnieje" });
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    return res.status(401).json({ error: "Obecne hasło jest nieprawidłowe" });
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });

  res.json({ ok: true });
});

export default router;
