import type { Request, Response, NextFunction } from "express";

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

function clientKey(req: Request, prefix: string): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : req.socket.remoteAddress ?? "unknown";
  return `${prefix}:${ip}`;
}

export function rateLimit(options: { windowMs: number; max: number; message: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = clientKey(req, options.message);
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > options.max) {
      return res.status(429).json({ error: options.message });
    }

    next();
  };
}
