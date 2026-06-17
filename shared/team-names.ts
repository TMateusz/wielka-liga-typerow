/** Mapowanie nazw angielskich → polskie (reprezentacje MŚ 2026). */
const TEAM_NAMES_PL: Record<string, string> = {
  Algeria: "Algieria",
  Argentina: "Argentyna",
  Australia: "Australia",
  Austria: "Austria",
  Belgium: "Belgia",
  "Bosnia and Herzegovina": "Bośnia i Hercegowina",
  Brazil: "Brazylia",
  Canada: "Kanada",
  "Cape Verde": "Republika Zielonego Przylądka",
  Colombia: "Kolumbia",
  "Congo DR": "DR Konga",
  "DR Congo": "DR Konga",
  "Democratic Republic of the Congo": "DR Konga",
  Croatia: "Chorwacja",
  "Côte d'Ivoire": "Wybrzeże Kości Słoniowej",
  "Cote d'Ivoire": "Wybrzeże Kości Słoniowej",
  Curaçao: "Curaçao",
  Curacao: "Curaçao",
  Czechia: "Czechy",
  "Czech Republic": "Czechy",
  Ecuador: "Ekwador",
  Egypt: "Egipt",
  England: "Anglia",
  France: "Francja",
  Germany: "Niemcy",
  Ghana: "Ghana",
  Haiti: "Haiti",
  Iran: "Iran",
  Iraq: "Irak",
  Italy: "Włochy",
  "Ivory Coast": "Wybrzeże Kości Słoniowej",
  Japan: "Japonia",
  Jordan: "Jordania",
  Mexico: "Meksyk",
  Morocco: "Maroko",
  Netherlands: "Holandia",
  "New Zealand": "Nowa Zelandia",
  Norway: "Norwegia",
  Panama: "Panama",
  Paraguay: "Paragwaj",
  Poland: "Polska",
  Portugal: "Portugalia",
  Qatar: "Katar",
  "Saudi Arabia": "Arabia Saudyjska",
  Scotland: "Szkocja",
  Senegal: "Senegal",
  "South Africa": "RPA",
  "South Korea": "Korea Południowa",
  Spain: "Hiszpania",
  Sweden: "Szwecja",
  Switzerland: "Szwajcaria",
  Tunisia: "Tunezja",
  Türkiye: "Turcja",
  Turkey: "Turcja",
  USA: "Stany Zjednoczone",
  "United States": "Stany Zjednoczone",
  Uruguay: "Urugwaj",
  Uzbekistan: "Uzbekistan",
  Wales: "Walia",
};

export function translateTeamName(name: string): string {
  if (!name) return name;
  if (TEAM_NAMES_PL[name]) return TEAM_NAMES_PL[name];

  const lower = name.toLowerCase();
  for (const [en, pl] of Object.entries(TEAM_NAMES_PL)) {
    if (en.toLowerCase() === lower) return pl;
  }

  return name;
}

const ENGLISH_BY_POLISH = Object.fromEntries(
  Object.entries(TEAM_NAMES_PL).map(([en, pl]) => [pl, en]),
);

/** Polska nazwa z bazy → angielska (do modelu siły drużyn). */
export function toEnglishTeamName(name: string): string {
  return ENGLISH_BY_POLISH[name] ?? name;
}

export function localizeMatch<T extends { homeTeam: string; awayTeam: string }>(match: T): T {
  return {
    ...match,
    homeTeam: translateTeamName(match.homeTeam),
    awayTeam: translateTeamName(match.awayTeam),
  };
}
