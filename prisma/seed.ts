import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { normalizeNickname } from "../shared/user-display.js";
import { prisma } from "../server/lib/prisma.js";

export async function seedUsers() {
  const adminNickname = normalizeNickname(process.env.ADMIN_USERNAME ?? "admin");
  const adminPassword = process.env.ADMIN_PASSWORD ?? "change-me-admin";
  const hashedAdmin = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { nickname: adminNickname },
    update: {
      firstName: "Admin",
      lastName: "",
      password: hashedAdmin,
      role: UserRole.ADMIN,
    },
    create: {
      firstName: "Admin",
      lastName: "",
      nickname: adminNickname,
      password: hashedAdmin,
      role: UserRole.ADMIN,
    },
  });

  console.log("✅ Seed zakończony: konto administratora.");
  console.log(`   Admin: nick "${adminNickname}" (hasło z ADMIN_PASSWORD)`);
  console.log("   Gracze rejestrują się sami przez formularz rejestracji.");
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  seedUsers()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
