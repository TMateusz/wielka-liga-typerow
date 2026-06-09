import { isPlaceholderTeam } from "./placeholders.js";
import { translateTeamName } from "./team-names.js";

/** Kody flag (flag-icons) — angielskie nazwy reprezentacji. */
const FLAG_BY_ENGLISH: Record<string, string> = {
  Algeria: "dz",
  Argentina: "ar",
  Australia: "au",
  Austria: "at",
  Belgium: "be",
  "Bosnia and Herzegovina": "ba",
  Brazil: "br",
  Canada: "ca",
  "Cape Verde": "cv",
  Colombia: "co",
  "Congo DR": "cd",
  Croatia: "hr",
  "Côte d'Ivoire": "ci",
  "Cote d'Ivoire": "ci",
  "Ivory Coast": "ci",
  Curaçao: "cw",
  Curacao: "cw",
  Czechia: "cz",
  "Czech Republic": "cz",
  Ecuador: "ec",
  Egypt: "eg",
  England: "gb-eng",
  France: "fr",
  Germany: "de",
  Ghana: "gh",
  Haiti: "ht",
  Iran: "ir",
  Iraq: "iq",
  Italy: "it",
  Japan: "jp",
  Jordan: "jo",
  Mexico: "mx",
  Morocco: "ma",
  Netherlands: "nl",
  "New Zealand": "nz",
  Norway: "no",
  Panama: "pa",
  Paraguay: "py",
  Poland: "pl",
  Portugal: "pt",
  Qatar: "qa",
  "Saudi Arabia": "sa",
  Scotland: "gb-sct",
  Senegal: "sn",
  "South Africa": "za",
  "South Korea": "kr",
  Spain: "es",
  Sweden: "se",
  Switzerland: "ch",
  Tunisia: "tn",
  Türkiye: "tr",
  Turkey: "tr",
  USA: "us",
  "United States": "us",
  Uruguay: "uy",
  Uzbekistan: "uz",
  Wales: "gb-wls",
};

const FLAG_BY_POLISH: Record<string, string> = {
  Algieria: "dz",
  Argentyna: "ar",
  Australia: "au",
  Austria: "at",
  Belgia: "be",
  "Bośnia i Hercegowina": "ba",
  Brazylia: "br",
  Kanada: "ca",
  "Republika Zielonego Przylądka": "cv",
  Kolumbia: "co",
  "DR Konga": "cd",
  Chorwacja: "hr",
  "Wybrzeże Kości Słoniowej": "ci",
  Curaçao: "cw",
  Czechy: "cz",
  Ekwador: "ec",
  Egipt: "eg",
  Anglia: "gb-eng",
  Francja: "fr",
  Niemcy: "de",
  Ghana: "gh",
  Haiti: "ht",
  Iran: "ir",
  Irak: "iq",
  Włochy: "it",
  Japonia: "jp",
  Jordania: "jo",
  Meksyk: "mx",
  Maroko: "ma",
  Holandia: "nl",
  "Nowa Zelandia": "nz",
  Norwegia: "no",
  Panama: "pa",
  Paragwaj: "py",
  Polska: "pl",
  Portugalia: "pt",
  Katar: "qa",
  "Arabia Saudyjska": "sa",
  Szkocja: "gb-sct",
  Senegal: "sn",
  RPA: "za",
  "Korea Południowa": "kr",
  Hiszpania: "es",
  Szwecja: "se",
  Szwajcaria: "ch",
  Tunezja: "tn",
  Turcja: "tr",
  "Stany Zjednoczone": "us",
  Urugwaj: "uy",
  Uzbekistan: "uz",
  Walia: "gb-wls",
};

/** Zwraca kod flagi (np. "pl", "gb-eng") lub null dla placeholderów. */
export function getTeamFlagCode(name: string): string | null {
  if (!name || isPlaceholderTeam(name)) return null;

  if (FLAG_BY_POLISH[name]) return FLAG_BY_POLISH[name];
  if (FLAG_BY_ENGLISH[name]) return FLAG_BY_ENGLISH[name];

  const lower = name.toLowerCase();
  for (const [key, code] of Object.entries(FLAG_BY_POLISH)) {
    if (key.toLowerCase() === lower) return code;
  }
  for (const [key, code] of Object.entries(FLAG_BY_ENGLISH)) {
    if (key.toLowerCase() === lower) return code;
  }

  const translated = translateTeamName(name);
  if (translated !== name && FLAG_BY_POLISH[translated]) {
    return FLAG_BY_POLISH[translated];
  }

  return null;
}

/** Klasy CSS flag-icons, np. "fi fi-pl". */
export function getTeamFlagClass(name: string): string | null {
  const code = getTeamFlagCode(name);
  if (!code) return null;
  return `fi fi-${code.toLowerCase()}`;
}
