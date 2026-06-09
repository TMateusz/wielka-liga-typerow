import { prisma } from "./prisma.js";

/** Lepsza współbieżność odczytów/zapisów przy wielu graczach (SQLite WAL). */
export async function tuneSqlite() {
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
  await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
}
