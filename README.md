# Familienkalender

Digitaler Wandkalender für die Familie – läuft komplett im Browser (z. B. auf einem iPad an der Wand), ohne eigenes Backend.

- **Outlook-Anbindung** über Microsoft Graph: jede Person meldet sich mit ihrem eigenen Microsoft-Konto an (nur Lesezugriff).
- **Familienmitglieder** mit Name, Farbe und Avatar (Initialen, Emoji oder Foto); pro Person wählbare Kalender.
- **Ansichten:** Tag, Woche, Monat, Jahr, Agenda – Wischen links/rechts blättert.
- **Personenfilter:** Chips oben antippen; doppelt tippen / lange drücken zeigt nur diese Person.
- Gemeinsame Termine (gleiche Einladung in mehreren Kalendern) werden zu einem Termin mit mehreren Farben zusammengeführt.
- **Export/Import** der Konfiguration als JSON (Einstellungen → Sicherung).
- Wandmodus: Bildschirm bleibt an, Rücksprung auf „Heute“ nach Inaktivität, Auto-Aktualisierung, Offline-Cache.
- **Demo-Familie** zum Ausprobieren ohne Outlook.

## Lokal starten

Unter Windows einfach **`start-lokal.bat`** doppelklicken – installiert bei Bedarf die Pakete, startet den Server und öffnet den Browser. Oder manuell:

```bash
npm install
npm run dev        # http://localhost:5173 (auch im WLAN erreichbar, --host)
npm run build      # Produktions-Build nach dist/
```

> Die Microsoft-Anmeldung funktioniert nur über `https://…` oder `http://localhost`. Vom iPad aus im WLAN (`http://192.168…`) geht also nur der Demo-Modus – für echte Outlook-Daten die GitHub-Pages-Version nutzen.

## Auf GitHub Pages veröffentlichen

1. Neues GitHub-Repository anlegen (z. B. `Family_Calendar`) und diesen Ordner pushen (Branch `main`).
2. Im Repo: **Settings → Pages → Source: GitHub Actions**.
3. Der Workflow `.github/workflows/deploy.yml` baut und veröffentlicht bei jedem Push.
   Adresse danach: `https://<dein-github-name>.github.io/Family_Calendar/`

## Microsoft-App-Registrierung (einmalig, kostenlos)

1. <https://entra.microsoft.com> → **App-Registrierungen → Neue Registrierung**
   (mit privatem Microsoft-Konto geht das ebenfalls; ggf. wird automatisch ein Verzeichnis angelegt).
2. Name: `Familienkalender`
   Kontotypen: **„Konten in einem beliebigen Organisationsverzeichnis und persönliche Microsoft-Konten“**.
3. Umleitungs-URI: Plattform **„Single-Page-Anwendung (SPA)“**, URI = deine GitHub-Pages-Adresse mit abschließendem `/`,
   z. B. `https://<name>.github.io/Family_Calendar/`. Für lokale Tests zusätzlich `http://localhost:5173/`.
   (Die exakte URI zeigt die App unter Einstellungen → Outlook an.)
4. **API-Berechtigungen:** Microsoft Graph → Delegiert → `User.Read`, `Calendars.Read` (kein Admin-Consent nötig).
5. Die **Anwendungs-ID (Client-ID)** kopieren und in der App unter **Einstellungen → Outlook** eintragen.

Dann unter **Einstellungen → Familie** je Person „Mit Outlook verbinden“ und die gewünschten Kalender anhaken.
Wenn sich nacheinander mehrere Personen anmelden, im Microsoft-Dialog jeweils „Anderes Konto verwenden“ wählen.

## iPad einrichten

- Seite in Safari öffnen → Teilen → **Zum Home-Bildschirm**.
- Für den Wandbetrieb: Einstellungen → Bedienungshilfen → **Geführter Zugriff** aktivieren, App öffnen, dreimal Seitentaste → Start.
- Automatische Sperre wird über die Wake-Lock-API verhindert (iPadOS ≥ 16.4); bei älteren Geräten Auto-Sperre auf „Nie“ stellen.

## Bekannte Einschränkung: Anmeldung läuft ab

Ohne Backend gibt Microsoft einer Browser-App Refresh-Tokens mit **24 Stunden** Laufzeit. Danach versucht MSAL eine stille
Erneuerung – Safari blockiert dafür nötige Drittanbieter-Cookies aber häufig. Folge: Eine Person muss sich ggf. einmal pro Tag
neu anmelden. Die App zeigt das am Personen-Chip mit **„Anmelden“** an und zeigt bis dahin die zuletzt geladenen Termine aus dem
Cache. Dauerhafte Abhilfe wäre später z. B. ein veröffentlichter ICS-Link pro Kalender oder ein kleiner Token-Dienst.

## Konfiguration & Datenschutz

- Alles (Personen, Avatare, Einstellungen, Termin-Cache, Tokens) liegt nur im `localStorage` des Geräts.
- Der Export (`familienkalender-JJJJ-MM-TT.json`) enthält **keine** Tokens. Nach dem Import auf einem anderen Gerät meldet sich jede Person einmal neu an.

## Projektstruktur

```
src/
  main.tsx              Start, verarbeitet Login-Redirect
  App.tsx               Layout, Navigation, Auto-Refresh, Wandmodus
  store.tsx             Konfiguration + Personenfilter (React Context, localStorage)
  lib/auth.ts           MSAL (mehrere Konten)
  lib/graph.ts          Microsoft-Graph-Aufrufe
  lib/events.ts         Termine laden, zusammenführen, cachen
  lib/demo.ts           Demo-Termine
  lib/config.ts         Defaults, Export/Import, Avatar-Bilder
  views/                Tag/Woche, Monat, Jahr, Agenda
  settings/             Einstellungsdialog
```
