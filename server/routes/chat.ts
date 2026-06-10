import { Router } from "express";
import {
  CHAT_HISTORY_LIMIT,
  CHAT_MAX_MESSAGE_LENGTH,
} from "../../shared/chat-limits.js";
import { prisma } from "../lib/prisma.js";
import { rateLimit } from "../lib/rate-limit.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

const sendLimit = rateLimit({
  windowMs: 10_000,
  max: 4,
  message: "Za dużo wiadomości — odczekaj chwilę",
});

function serializeMessage(message: {
  id: string;
  text: string;
  createdAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    nickname: string;
    role: "USER" | "ADMIN";
  };
}) {
  return {
    id: message.id,
    text: message.text,
    createdAt: message.createdAt.toISOString(),
    user: {
      id: message.user.id,
      firstName: message.user.firstName,
      lastName: message.user.lastName,
      nickname: message.user.nickname,
      role: message.user.role,
    },
  };
}

const messageSelect = {
  id: true,
  text: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nickname: true,
      role: true,
    },
  },
} as const;

router.get("/", requireAuth, async (_req, res) => {
  const messages = await prisma.chatMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: CHAT_HISTORY_LIMIT,
    select: messageSelect,
  });

  res.json({ messages: messages.reverse().map(serializeMessage) });
});

router.post("/", requireAuth, sendLimit, async (req, res) => {
  const text = typeof req.body.text === "string" ? req.body.text.trim() : "";

  if (!text) {
    return res.status(400).json({ error: "Wiadomość nie może być pusta" });
  }

  if (text.length > CHAT_MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      error: `Maksymalnie ${CHAT_MAX_MESSAGE_LENGTH} znaków`,
    });
  }

  const message = await prisma.chatMessage.create({
    data: {
      userId: req.user!.id,
      text,
    },
    select: messageSelect,
  });

  res.status(201).json({ message: serializeMessage(message) });
});

/** Usuwa wyłącznie wiadomość czatu — bez wpływu na konta, typy ani wyniki meczów. */
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = req.params.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Nieprawidłowe ID wiadomości" });
  }

  const existing = await prisma.chatMessage.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return res.status(404).json({ error: "Wiadomość nie istnieje" });
  }

  await prisma.chatMessage.delete({ where: { id } });

  res.json({ ok: true });
});

export default router;
