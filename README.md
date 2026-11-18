# Familienkalender

Digitaler Wandkalender für die Familie – läuft komplett im Browser (z. B. auf einem iPad an der Wand), ohne Anmeldung und ohne eigenen Server.

- **Kalender per Abo-Link (ICS):** Google, Microsoft privat (Outlook.com/Live), Microsoft 365 (geschäftlich), iCloud und jeder andere iCal-Link. Keine Anmeldung, nichts läuft ab.
- **Kalender getrennt von Personen:** Unter Einstellungen → Kalender fügst du Abo-Links hinzu, gibst jedem Kalender einen Namen und ordnest ihn einer oder mehreren Personen zu. Wird eine Person gelöscht, bleiben die Kalender erhalten.
- **Feiertage und Schulferien** aller Bundesländer (OpenHolidays API) – personenunabhängig, als Markierung im Kalender, in den Einstellungen ein-/ausschaltbar.
- **Familienmitglieder** mit Name, Farbe und Avatar (Initialen, Emoji oder Foto).
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
```

## Weiterleitung (Cloudflare Worker, einmalig, kostenlos)

Google und Microsoft erlauben nicht, dass eine Webseite die Abo-Links direkt im Browser lädt (CORS). Der kleine Worker in
`worker/worker.js` holt die Links ab und reicht sie weiter. Er speichert nichts und lässt nur Google, Outlook/Microsoft und iCloud zu.

1. <https://dash.cloudflare.com> → Workers & Pages → Erstellen → „Mit Hello World beginnen“, Name `familienkalender-ics`, Bereitstellen.
2. „Code bearbeiten“, alles durch den Inhalt von `worker/worker.js` ersetzen, Bereitstellen.
3. Die Adresse (`https://familienkalender-ics.<name>.workers.dev`) in der App unter **Einstellungen → Kalender → Weiterleitung** eintragen.

Erlaubte Seiten (GitHub-Pages-Adresse, localhost, Heimnetz) stehen oben im Worker-Code.

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
- Der Export enthält die geheimen Kalender-Links – nicht weitergeben.
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
worker/worker.js        Cloudflare Worker (Weiterleitung)
```
