# Familienkalender

Digitaler Wandkalender für die Familie – läuft komplett im Browser (z. B. auf einem iPad an der Wand), ohne Anmeldung und ohne eigenen Server.

- **Kalender per Abo-Link (ICS):** Google, Microsoft privat (Outlook.com/Live), Microsoft 365 (geschäftlich), iCloud und jeder andere iCal-Link. Keine Anmeldung, nichts läuft ab.
- **Kalender getrennt von Personen:** Unter Einstellungen → Kalender fügst du Abo-Links hinzu, gibst jedem Kalender einen Namen und ordnest ihn einer oder mehreren Personen zu. Wird eine Person gelöscht, bleiben die Kalender erhalten.
- **Feiertage und Schulferien** aller Bundesländer (OpenHolidays API) – personenunabhängig, als Markierung im Kalender, in den Einstellungen ein-/ausschaltbar.
- **Familienmitglieder** mit Name, Farbe und Avatar (Initialen, Emoji oder Foto).
- **Stundenplan** als eigenes Modul: pro Kind Mo–Fr × Schulstunden mit Klingelzeiten, Fächer in Farben (vordefiniert für Grundschule und Gymnasium, eigene möglich), Eintragen per Mal-Modus. Heute und die laufende Stunde sind markiert, an Feiertagen und in den Ferien wird der Tag ausgegraut. Einschalten unter Einstellungen → Familie, Klingelzeiten und Farben unter Einstellungen → Schule.
- **Ansichten:** Tag, Woche, Monat, Jahr, Agenda – Wischen links/rechts blättert.
- **Personenfilter:** Avatar antippen zeigt nur diese Person (nochmal antippen oder „Alle“ = alle). Lange drücken nimmt eine Person dazu bzw. wieder heraus.
- Gleiche Termine in mehreren Kalendern werden zu einem Termin mit mehreren Farben zusammengeführt.
- **Export/Import** der Konfiguration als JSON (Einstellungen → Sicherung).
- Wandmodus: Bildschirm bleibt an, Rücksprung auf „Heute“ nach Inaktivität, Auto-Aktualisierung, Offline-Cache.
- **Demo-Termine** zum Ausprobieren.

## Lokal starten

Unter Windows einfach **`start-lokal.bat`** doppelklicken. Oder manuell:

```bash
npm install
npm run dev        # http://localhost:5173 (auch im WLAN erreichbar, --host)
npm run build      # Produktions-Build nach dist/
npm run check      # Typecheck, ESLint, Prettier und Tests (läuft auch vor jedem Deploy)
npm run format     # Code mit Prettier formatieren
```

## Weiterleitung (Cloudflare Worker, einmalig, kostenlos)

Google und Microsoft erlauben nicht, dass eine Webseite die Abo-Links direkt im Browser lädt (CORS). Der kleine Worker in
`worker/worker.js` holt die Links ab und reicht sie weiter. Er speichert nichts und schreibt keine Logs.

- Die App schickt den geheimen Kalender-Link im Body einer `POST`-Anfrage – er steht nicht in der Adresse und taucht so
  nicht in Cloudflare-Logs oder -Statistiken auf.
- Weitergegeben werden nur echte iCal-Dateien bis 5 MB; IP-Adressen, `localhost` und Heimnetz-Namen sind gesperrt,
  auch als Ziel einer Weiterleitung des Kalender-Anbieters.
- Cloudflare hält einen Kalender 5 Minuten vor; „Neu laden“ in der App holt ihn am Cache vorbei frisch.

### Einrichten mit wrangler (empfohlen)

```bash
npx wrangler@4 login
```

```bash
npm run worker:deploy
```

Die Einstellungen stehen in `worker/wrangler.toml`: `ALLOWED_HOSTS` (erlaubte Kalender-Server, Standard `*` = alle;
strenger z. B. `calendar.google.com, outlook.live.com, outlook.office365.com, *.icloud.com`) und `ALLOWED_ORIGINS`
(Seiten, die den Worker im Browser nutzen dürfen – localhost und Heimnetz sind immer erlaubt). Lokal testen:
`npm run worker:dev`.

### Oder im Cloudflare-Dashboard

1. <https://dash.cloudflare.com> → Workers & Pages → Erstellen → „Mit Hello World beginnen“, Name `familienkalender-ics`, Bereitstellen.
2. „Code bearbeiten“, alles durch den Inhalt von `worker/worker.js` ersetzen, Bereitstellen.
3. Optional unter Einstellungen → Variablen `ALLOWED_HOSTS` / `ALLOWED_ORIGINS` setzen.

Danach die Adresse (`https://familienkalender-ics.<name>.workers.dev`) in der App unter
**Einstellungen → Kalender → Weiterleitung** eintragen und „Speichern & testen“.

### Schlüssel (empfohlen)

Ohne Schlüssel kann jeder, der die Worker-Adresse kennt, ihn als ICS-Weiterleitung benutzen. Mit Schlüssel bedient der
Worker nur noch die eigene App:

1. Einen langen Zufallswert als Secret `ACCESS_KEY` setzen – `npx wrangler@4 secret put ACCESS_KEY --config worker/wrangler.toml`
   oder im Dashboard unter Einstellungen → Variablen und Secrets (Typ „Secret“).
2. Denselben Wert in der App unter **Einstellungen → Kalender → Weiterleitung** ins Feld „Schlüssel“ eintragen,
   „Speichern & testen“. Auf jedem Gerät nötig (oder per Sicherung übertragen).

Reihenfolge beim Umstieg von einer älteren Version: erst den neuen Worker bereitstellen, dann den Schlüssel setzen.
Die App kommt mit altem und neuem Worker zurecht.

## Abo-Links finden

| Anbieter | Wo |
|---|---|
| Google | calendar.google.com → Einstellungen → Kalender wählen → „Kalender integrieren“ → **Privatadresse im iCal-Format** |
| Outlook.com / Live | outlook.live.com → Einstellungen → Kalender → Freigegebene Kalender → **Kalender veröffentlichen** → ICS-Link |
| Microsoft 365 | outlook.office.com → genauso; fehlt die Option, hat die IT das Veröffentlichen gesperrt |
| iCloud | Kalender-App → Info → **Öffentlicher Kalender** |

Die Links sind geheim: Wer sie kennt, kann die Termine lesen. Änderungen kommen je nach Anbieter mit etwas Verzögerung an
(Google teils mehrere Stunden, Outlook meist schneller).

## Auf GitHub Pages veröffentlichen

1. Im Repo: **Settings → Pages → Source: GitHub Actions**.
2. Der Workflow `.github/workflows/deploy.yml` baut und veröffentlicht bei jedem Push.
   Adresse danach: `https://<dein-github-name>.github.io/family-calendar/`

## iPad einrichten

- Seite in Safari öffnen → Teilen → **Zum Home-Bildschirm**.
- Konfiguration vom Computer übertragen: dort Einstellungen → Sicherung → Exportieren, Datei aufs iPad (AirDrop/iCloud) und importieren.
- Für den Wandbetrieb: Einstellungen → Bedienungshilfen → **Geführter Zugriff** aktivieren, App öffnen, dreimal Seitentaste → Start.
- Automatische Sperre wird über die Wake-Lock-API verhindert (iPadOS ≥ 16.4); bei älteren Geräten Auto-Sperre auf „Nie“ stellen.

## Konfiguration & Datenschutz

- Alles (Personen, Kalender-Links, Einstellungen, Termin-Cache) liegt nur im `localStorage` des Geräts.
- Der Export enthält die geheimen Kalender-Links und den Schlüssel der Weiterleitung – nicht weitergeben.
- Feiertage/Ferien: [OpenHolidays API](https://www.openholidaysapi.org), Lizenz ODbL.

## Projektstruktur

```
src/
  main.tsx              Start
  App.tsx               Layout, Navigation, Auto-Refresh, Wandmodus
  store.tsx             Konfiguration (Personen, Kalender) + Personenfilter
  lib/ics.ts            iCal-Parser inkl. Serienterminen und Zeitzonen
  lib/events.ts         Abo-Links über die Weiterleitung laden, zusammenführen, cachen
  lib/holidays.ts       Feiertage/Schulferien (OpenHolidays API)
  lib/demo.ts           Demo-Termine
  lib/config.ts         Defaults, Migration, Export/Import, Avatar-Bilder
  views/                Tag/Woche, Monat, Jahr, Agenda
  settings/             Einstellungsdialog
worker/                 Cloudflare Worker (Weiterleitung), wrangler.toml, Tests
```
