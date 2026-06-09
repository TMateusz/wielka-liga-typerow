const ABBREV: Record<string, string> = {
  Algieria: "ALG",
  Argentyna: "ARG",
  Australia: "AUS",
  Austria: "AUT",
  Belgia: "BEL",
  "Bośnia i Hercegowina": "BIH",
  Brazylia: "BRA",
  Kanada: "CAN",
  "Republika Zielonego Przylądka": "CPV",
  Kolumbia: "COL",
  "DR Konga": "COD",
  Chorwacja: "CRO",
  "Wybrzeże Kości Słoniowej": "CIV",
  Czechy: "CZE",
  Ekwador: "ECU",
  Egipt: "EGY",
  Anglia: "ENG",
  Francja: "FRA",
  Niemcy: "GER",
  Haiti: "HAI",
  Iran: "IRN",
  Irak: "IRQ",
  Japonia: "JPN",
  Jordania: "JOR",
  Meksyk: "MEX",
  Maroko: "MAR",
  Holandia: "NED",
  "Nowa Zelandia": "NZL",
  Norwegia: "NOR",
  Panama: "PAN",
  Paragwaj: "PAR",
  Polska: "POL",
  Portugalia: "POR",
  Katar: "QAT",
  "Arabia Saudyjska": "KSA",
  Szkocja: "SCO",
  Senegal: "SEN",
  RPA: "RSA",
  "Korea Południowa": "KOR",
  Hiszpania: "ESP",
  Szwecja: "SWE",
  Szwajcaria: "SUI",
  Tunezja: "TUN",
  Turcja: "TUR",
  "Stany Zjednoczone": "USA",
  Urugwaj: "URU",
  Uzbekistan: "UZB",
};

/** Skrót drużyny na wąską kolumnę (mobile). */
export function abbreviateTeam(name: string): string {
  if (ABBREV[name]) return ABBREV[name];
  if (name.length <= 4) return name.toUpperCase();
  // Placeholdery pucharowe — skróć do pierwszych słów
  if (name.includes("miejsce") || name.includes("Zwycięzca") || name.includes("Przegrany")) {
    const words = name.split(" ");
    if (words.length >= 3) return `${words[0].slice(0, 1)}.${words[1].slice(0, 3)}`;
    return name.slice(0, 6);
  }
  return name.slice(0, 3).toUpperCase();
}
