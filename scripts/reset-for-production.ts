import { MatchStatus, UserRole } from "@prisma/client";
import { prisma } from "../server/lib/prisma.js";

async function main() {
  const deletedPredictions = await prisma.prediction.deleteMany();
  const deletedUsers = await prisma.user.deleteMany({ where: { role: UserRole.USER } });
  const resetMatches = await prisma.match.updateMany({
    data: {
      homeScore: null,
      awayScore: null,
      knockoutWinner: null,
      status: MatchStatus.PENDING,
    },
  });
  await prisma.user.updateMany({
    where: { role: UserRole.ADMIN },
    data: { totalPoints: 0 },
  });

  console.log("✅ Baza wyczyszczona pod produkcję:");
  console.log(`   Usunięte typy: ${deletedPredictions.count}`);
  console.log(`   Usunięci gracze: ${deletedUsers.count}`);
  console.log(`   Zresetowane mecze: ${resetMatches.count}`);
  console.log("   Został tylko admin (bez punktów).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
