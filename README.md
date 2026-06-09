# Wielka Liga Typerów

Publiczna liga typerów na **Mistrzostwa Świata 2026**. Każdy może się **sam zarejestrować** — imię, nazwisko, nick i hasło. Admin zarządza meczami i wynikami.

## Funkcje

- **Rejestracja** — imię, nazwisko, nick (login), hasło
- **Ranking publiczny** — podgląd bez logowania
- **Typowanie** — dokładny wynik = 3 pkt, poprawny wynik = 1 pkt
- **Panel admina** — import meczów MŚ 2026, wpisywanie wyników

## Wymagania

- **Node.js 20+** (do developmentu)
- **Docker** (do produkcji — zalecane)
- Windows / macOS / Linux

---

## Instalacja krok po kroku (dla kolegi)

### Krok 1 — Pobierz projekt

```bash
git clone https://github.com/TWOJ_USER/wielka-liga-typerow.git
cd wielka-liga-typerow
```

### Krok 2 — Skopiuj konfigurację

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**Linux / macOS:**
```bash
cp .env.example .env
```

### Krok 3 — Ustaw hasła i kod rejestracji

Otwórz plik `.env` w notatniku i **zmień przynajmniej te 3 wartości**:

```env
JWT_SECRET="wklej-tutaj-długi-losowy-ciag-znakow"
ADMIN_PASSWORD="silne-haslo-admina"
REGISTRATION_CODE="kod-dla-grupy-na-messengerze"
```

| Zmienna | Co to jest |
|---------|------------|
| `JWT_SECRET` | Losowy długi string — sesje graczy (wygeneruj np. na [random.org](https://www.random.org/strings/)) |
| `ADMIN_PASSWORD` | Hasło do konta admina (nick: `admin`) |
| `REGISTRATION_CODE` | Kod zaproszenia — bez niego nikt się nie zarejestruje. Wyślij grupie prywatnie. |

Opcjonalnie:
- `MAX_PLAYERS=100` — limit graczy (0 = bez limitu)
- `MAX_ACCOUNTS_PER_IP=2` — max kont z jednego IP

### Krok 4 — Uruchom na serwerze (Docker — produkcja)

```bash
docker compose up --build -d
docker compose --profile seed run --rm seed
```

Pierwsza komenda buduje i startuje aplikację. Druga (jednorazowo) tworzy konto admina i importuje 104 mecze MŚ 2026.

**Aplikacja:** http://ADRES-SERWERA:3000

### Krok 5 — Sprawdź czy działa

1. Wejdź na stronę w przeglądarce
2. Kliknij **Ranking** — powinien się załadować bez logowania
3. Zaloguj się jako admin: nick `admin`, hasło z `ADMIN_PASSWORD`
4. W panelu **Admin** możesz wpisywać wyniki meczów

### Krok 6 — Wyślij link grupie

Gracze:
1. Wchodzą na stronę
2. Klikają **Dołącz**
3. Wpisują imię, nazwisko, nick, hasło i **kod rejestracji** z `.env`

---

## Development lokalny (opcjonalnie)

```bash
npm install
npm run db:setup
npm run dev
```

- Frontend: http://localhost:5174
- API: http://localhost:3002 (port z `PORT` w `.env`)

**Admin:** nick `admin`, hasło z `ADMIN_PASSWORD`

---

## Aktualizacja na serwerze

```bash
git pull
docker compose up --build -d
```

Baza SQLite jest w wolumenie Dockera — dane graczy **nie znikają** przy aktualizacji.

---

## Stack

React 19 · Vite · Express · SQLite · Prisma · JWT · Docker

## Autor

Mateusz Turowski
