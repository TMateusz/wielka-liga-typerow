import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { normalizeNickname } from "../shared/user-display.js";
import { setMatchResult } from "../server/lib/match-service.js";
import { prisma } from "../server/lib/prisma.js";

const DEMO_PASSWORD = "demo";

const PLAYERS = [
  { firstName: "Adam", lastName: "Nowak", nickname: "adam_n" },
  { firstName: "Piotr", lastName: "Kowalski", nickname: "piotr_k" },
  { firstName: "Kamil", lastName: "Wiśniewski", nickname: "kamil_w" },
  { firstName: "Tomasz", lastName: "Kowalczyk", nickname: "tomek_k" },
  { firstName: "Paweł", lastName: "Zieliński", nickname: "pawel_z" },
  { firstName: "Marcin", lastName: "Woźniak", nickname: "marcin_w" },
  { firstName: "Jakub", lastName: "Kamiński", nickname: "kuba_k" },
  { firstName: "Łukasz", lastName: "Lewandowski", nickname: "lukasz_l" },
  { firstName: "Szymon", lastName: "Dąbrowski", nickname: "szymon" },
  { firstName: "Filip", lastName: "Kozłowski", nickname: "filip" },
  { firstName: "Kacper", lastName: "Jankowski", nickname: "kacper" },
  { firstName: "Oskar", lastName: "Mazur", nickname: "oskar" },
  { firstName: "Wojciech", lastName: "Krawczyk", nickname: "wojtek" },
  { firstName: "Dawid", lastName: "Piotrowski", nickname: "dawid" },
  { firstName: "Patryk", lastName: "Grabowski", nickname: "patryk" },
  { firstName: "Sebastian", lastName: "Pawłowski", nickname: "seba" },
  { firstName: "Dominik", lastName: "Michalski", nickname: "dominik" },
  { firstName: "Adrian", lastName: "Król", nickname: "adrian" },
  { firstName: "Hubert", lastName: "Wieczorek", nickname: "hubert" },
  { firstName: "Konrad", lastName: "Jabłoński", nickname: "konrad" },
  { firstName: "Rafał", lastName: "Wróbel", nickname: "rafal" },
  { firstName: "Norbert", lastName: "Adamczyk", nickname: "norbert" },
  { firstName: "Grzegorz", lastName: "Malinowski", nickname: "greg_m" },
  { firstName: "Michał", lastName: "Lewandowski", nickname: "michal" },
  { firstName: "Bartosz", lastName: "Sikora", nickname: "bartek_s" },
  { firstName: "Igor", lastName: "Walczak", nickname: "igor_w" },
  { firstName: "Juliusz", lastName: "Baran", nickname: "juliusz" },
  { firstName: "Kuba", lastName: "Górski", nickname: "kuba_g" },
  { firstName: "Aleks", lastName: "Lis", nickname: "aleks" },
  { firstName: "Daniel", lastName: "Wójcik", nickname: "daniel" },
];

function pseudoRandom(seed: number, min: number, max: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  const frac = x - Math.floor(x);
  return min + Math.floor(frac * (max - min + 1));
}

export async function seedDemoPlayers() {
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 12);
  const userIds: string[] = [];

  for (const [index, player] of PLAYERS.entries()) {
    const nickname = normalizeNickname(player.nickname);
    const hoursAgo = pseudoRandom(index + 1, 1, 72);
    const lastActiveAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const user = await prisma.user.upsert({
      where: { nickname },
      update: {
        firstName: player.firstName,
        lastName: player.lastName,
        password: hashed,
        role: UserRole.USER,
        lastActiveAt,
      },
      create: {
        firstName: player.firstName,
        lastName: player.lastName,
        nickname,
        password: hashed,
        role: UserRole.USER,
        lastActiveAt,
      },
    });
    userIds.push(user.id);
  }

  const matches = await prisma.match.findMany({
    orderBy: { kickoffTime: "asc" },
    take: 25,
  });

  let predictions = 0;

  for (const [mIndex, match] of matches.entries()) {
    for (const [uIndex, userId] of userIds.entries()) {
      const seed = mIndex * 100 + uIndex;
      if (pseudoRandom(seed, 0, 10) > 7) continue;

      const home = pseudoRandom(seed + 1, 0, 3);
      const away = pseudoRandom(seed + 2, 0, 3);

      await prisma.prediction.upsert({
        where: { userId_matchId: { userId, matchId: match.id } },
        update: {
          predictedHomeScore: home,
          predictedAwayScore: away,
        },
        create: {
          userId,
          matchId: match.id,
          predictedHomeScore: home,
          predictedAwayScore: away,
        },
      });
      predictions += 1;
    }
  }

  const toFinish = matches.slice(0, 4);
  const results: [number, number][] = [
    [2, 1],
    [1, 1],
    [0, 2],
    [3, 0],
  ];

  for (const [i, match] of toFinish.entries()) {
    const [home, away] = results[i] ?? [1, 0];
    await setMatchResult(match.id, home, away);
  }

  const top = await prisma.user.findMany({
    where: { role: UserRole.USER },
    orderBy: { totalPoints: "desc" },
    take: 5,
    select: { firstName: true, lastName: true, nickname: true, totalPoints: true },
  });

  console.log(`✅ Utworzono/zaktualizowano ${PLAYERS.length} graczy demo.`);
  console.log(`   Hasło wszystkich: "${DEMO_PASSWORD}"`);
  console.log(`   Typów: ${predictions}, zakończonych meczów: ${toFinish.length}`);
  console.log("   Top 5:");
  for (const [i, u] of top.entries()) {
    console.log(`   ${i + 1}. ${u.firstName} ${u.lastName} (@${u.nickname}) — ${u.totalPoints} pkt`);
  }
}

seedDemoPlayers()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
