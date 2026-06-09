import { translateTeamName } from "../shared/team-names.js";
import { prisma } from "../server/lib/prisma.js";

const matches = await prisma.match.findMany();

let updated = 0;
for (const m of matches) {
  const homeTeam = translateTeamName(m.homeTeam);
  const awayTeam = translateTeamName(m.awayTeam);
  if (homeTeam !== m.homeTeam || awayTeam !== m.awayTeam) {
    await prisma.match.update({
      where: { id: m.id },
      data: { homeTeam, awayTeam },
    });
    updated++;
  }
}

console.log(`✅ Zaktualizowano nazwy w ${updated} meczach (łącznie ${matches.length}).`);
await prisma.$disconnect();
