# HomeWally

Your shared living wall calendar: a digital family hub for a tablet on the wall. It runs entirely in the browser, with
no sign-in and no server of your own. Website: <https://indigo-dev.github.io/homewally/>

The same code also ships as the Android app and home-screen launcher **HomeWally** (see [Android app](#android-app)).
The app speaks German and English (Settings → Device, or the device language).

<img width="1501" height="892" alt="image" src="https://github.com/user-attachments/assets/bc3116d1-fa53-48ef-b988-11b33ce20410" />

## What's inside

- **Overview (dashboard):** the start page with widgets – clock, weather, events today & tomorrow, timetable, to-dos,
  shopping list, photos, holiday countdown, pollen & UV, family today. Widgets come in several sizes; long-press (or the
  pencil) to move, resize, add or remove them, like on a phone's home screen. Tapping a widget opens its area; tapping
  the clock starts the screensaver.
- **Calendar:** day, N days, week, month, year and agenda; swipe to page, pinch to zoom. Calendars come in via
  subscription links (ICS) – Google, Outlook.com, Microsoft 365, iCloud or any iCal link; no sign-in, nothing expires.
  Calendars are separate from people: give each a name and assign it to one or more people. Identical events in several
  calendars are merged into one event with several colours. Public and school holidays for all German states are shown
  as markers.
- **Person filter:** tap an avatar to show only that person (tap again or “All” = everyone); long-press adds or removes
  a person.
- **Timetable:** per child Mon–Fri × periods with bell times and coloured subjects (presets for primary and secondary
  school, custom subjects possible), filled in with a paint mode. Today and the current period are highlighted, holidays
  greyed out.
- **To-dos:** a free pin board with notes per person; move them around, pinch to resize, tick them off.
- **Shopping:** a pantry of everyday items to tap onto the list, sorted by department; tick items off in the store or
  right on the overview.
- **Weather:** several places as tabs, the next hours (tap an hour for details), the coming days, official warnings,
  pollen and UV index.
- **Photos & screensaver:** an album on the device and a slideshow with clock faces (also a word clock) and today's
  events. After a set idle time – or with a tap on the clock – it runs as the screensaver.
- **Voice control (optional):** a microphone button; the spoken request goes to Google Gemini with your own API key
  (Settings → Voice control). It adds to-dos and shopping items, answers questions about events and the weather
  and opens an area, also for a certain person.
- **Apps (Android app only):** lists and starts installed apps, so the tablet can use HomeWally as its home screen.
- **Wall mode:** the screen stays on, the app returns to the overview after inactivity, refreshes itself and works
  offline from its cache.

## Design

- **Styles** (Settings → Design → Style): **HomeWally** is the app's own design and the default – night indigo or
  daylight, the five-colour spectrum of the logo (every area has its colour), a warm roof gradient for actions and
  Plus Jakarta Sans. The other styles (Classic, Glass · Clear, Glass · Flow, Glass · Aurora, Workflow · Nodes,
  Minimal · Functional) are still available. Light/dark follows the device or is set by hand.
- **Colours follow the style:** people, subjects and shopping departments keep the colour they were given, but each
  style draws them in its own palette (HomeWally: the logo spectrum, Minimal: muted tones, others: vivid).
- **Symbols:** shopping symbols (OpenMoji by default, other colour, one-colour and line sets) and weather icons
  (Meteocons, Material, Fluent) are bundled with the app – nothing is loaded from icon services at runtime.
- **Transitions** between the areas: fade (default), glide, zoom or instant.
- All fonts are bundled locally (no Google Fonts).

## Try it & start over

- **Demo family:** on the first start (or later under Settings → Backup) the app can load a demo family that fills
  every area – events, timetables, to-dos, shopping list, weather places and photos.
- **Remove demo data:** Settings → Backup removes only the demo data and keeps everything you entered yourself.
- **Reset the app:** Settings → Backup puts the app back into its first-start state on this device.
- **Export/import** of the configuration as JSON (Settings → Backup) moves the setup to another device.

## Run locally

On Windows just double-click **`start-lokal.bat`**. Or manually:

```bash
npm install
npm run dev        # http://localhost:5173 (also reachable on the local network, --host)
npm run build      # production build to dist/
npm run check      # typecheck, ESLint, Prettier and tests (also runs before every deploy)
npm run format     # format the code with Prettier
```

## Proxy (Cloudflare Worker, one-time, free)

Google and Microsoft don't allow a website to load subscription links directly in the browser (CORS). The small worker
in `worker/worker.js` fetches the links and passes them on. It stores nothing and writes no logs. (The Android app
fetches calendars directly and doesn't need the worker.)

- The app sends the secret calendar link in the body of a `POST` request – it is not part of the URL and therefore
  doesn't show up in Cloudflare logs or analytics.
- Only real iCal files up to 5 MB are passed on; IP addresses, `localhost` and local network names are blocked, also as
  the target of a redirect from the calendar provider.
- Cloudflare caches a calendar for 5 minutes; “Reload” in the app bypasses the cache and fetches it fresh.

### Set up with wrangler (recommended)

```bash
npx wrangler@4 login
```

```bash
npm run worker:deploy
```

The settings live in `worker/wrangler.toml`: `ALLOWED_HOSTS` (allowed calendar servers, default `*` = all; stricter
e.g. `calendar.google.com, outlook.live.com, outlook.office365.com, *.icloud.com`) and `ALLOWED_ORIGINS` (sites allowed
to use the worker from the browser – localhost and the local network are always allowed). Test locally:
`npm run worker:dev`.

### Or in the Cloudflare dashboard

1. <https://dash.cloudflare.com> → Workers & Pages → Create → “Start with Hello World”, name `homewally-ics-proxy`,
   Deploy.
2. “Edit code”, replace everything with the contents of `worker/worker.js`, Deploy.
3. Optionally set `ALLOWED_HOSTS` / `ALLOWED_ORIGINS` under Settings → Variables.

Then enter the address (`https://homewally-ics-proxy.<name>.workers.dev`) in the app under
**Settings → Calendars → Proxy** and click “Save & test”.

### Access key (recommended)

Without a key, anyone who knows the worker address can use it as an ICS proxy. With a key, the worker only serves your
own app:

1. Set a long random value as the secret `ACCESS_KEY` – `npx wrangler@4 secret put ACCESS_KEY --config worker/wrangler.toml`
   or in the dashboard under Settings → Variables and Secrets (type “Secret”).
2. Enter the same value in the app under **Settings → Calendars → Proxy** in the “Key” field and click “Save & test”.
   Needed on every device (or transfer it via backup).

Errors come back as English codes (e.g. `{"error": "host_not_allowed", "detail": "example.com"}`); the app shows them
in its own language.

## Finding subscription links

| Provider | Where |
|---|---|
| Google | calendar.google.com → Settings → choose calendar → “Integrate calendar” → **Secret address in iCal format** |
| Outlook.com / Live | outlook.live.com → Settings → Calendar → Shared calendars → **Publish a calendar** → ICS link |
| Microsoft 365 | outlook.office.com → same as above; if the option is missing, IT has disabled publishing |
| iCloud | Calendar app → Info → **Public Calendar** |

The links are secret: anyone who knows them can read the events. Depending on the provider, changes arrive with some
delay (Google sometimes several hours, Outlook usually faster).

## Publish on GitHub Pages

1. In the repo: **Settings → Pages → Source: GitHub Actions**.
2. The workflow `.github/workflows/deploy.yml` builds and publishes on every push.
   Address afterwards: `https://<your-github-name>.github.io/homewally/`

## Android app

The Android app **HomeWally** wraps the same web code with [Capacitor](https://capacitorjs.com) and can be set as the
tablet's home screen (launcher), including the “Apps” area that lists and starts installed apps. It loads calendar links
directly, without the worker, and can read answers of the voice control aloud.

- Native project: `android/`; configuration: `capacitor.config.ts` (package name `io.github.indigodev.homewally` –
  fixed in the Play Store, never change it).
- Build locally: `npm run android:sync` (build + `cap sync`), then open `android/` in Android Studio.
- App icon: adaptive icon (background, foreground and a monochrome layer for themed icons) as vector drawables in
  `android/app/src/main/res/drawable/`; the web icons are in `public/`.
- The workflow `.github/workflows/android.yml` builds a signed AAB on every push to `main` and uploads it to Google Play
  (internal testing), so the tablets update themselves. Required repository secrets are listed at the top of the
  workflow file.

## Set up a tablet or computer

- **iPad:** open the page in Safari → Share → **Add to Home Screen**.
- **Edge / Chrome (Windows, Android):** open the page → menu → **Install app**; it then runs in its own window.
- Transfer the configuration from another device: there Settings → Backup → Export, move the file over (e.g.
  AirDrop/iCloud) and import it.
- iPad for wall use: Settings → Accessibility → enable **Guided Access**, open the app, triple-click the side button →
  Start.
- Auto-lock is prevented via the Wake Lock API (iPadOS ≥ 16.4); on older devices set Auto-Lock to “Never”.

## Configuration & privacy

- Everything (people, calendar links, settings, event cache, to-dos, shopping list, weather places) is stored only on
  the device, in `localStorage`; photos in IndexedDB. There is no server of ours.
- The export contains the secret calendar links, the proxy key and the voice API key – don't share it.
- Services the app talks to directly:
  - Public/school holidays: [OpenHolidays API](https://www.openholidaysapi.org), licence ODbL.
  - Weather, places, pollen and UV: [Open-Meteo](https://open-meteo.com); weather warnings of the DWD via
    [Bright Sky](https://brightsky.dev).
  - Voice control (only when switched on with your own key): Google Gemini API.
  - Demo photos: picsum.photos (only when the demo family is loaded).

## Project structure

```
src/
  main.tsx              entry point (fonts, styles, service worker)
  App.tsx               shell: module navigation, wall mode, screensaver
  store.tsx             configuration (people, calendars, settings), colour painter, person filter
  wally.css             the HomeWally design (default style)
  themes.css            the other selectable styles
  styles.css            app shell and shared components
  dashboard/            overview with its widgets
  CalendarModule.tsx    calendar area; views/ = day/days/week, month, year, agenda
  timetable/ todos/ shopping/ weather/ frame/ apps/ voice/
                        the other areas
  settings/             settings dialog
  lib/ics.ts            iCal parser incl. recurring events and time zones
  lib/events.ts         load subscription links via the proxy (or directly in the app), merge, cache
  lib/holidays.ts       public/school holidays (OpenHolidays API)
  lib/colors.ts         palettes per style and the colour painter
  lib/demoData.ts       demo family for every area, remove demo data, reset
  lib/config.ts         defaults, validation, export/import, avatar images
  i18n/                 German (source) and English texts
  native/               bridge to the Android app (launcher, direct calendar fetch, speech)
public/                 icons, manifest, service worker, bundled symbols and weather icons
worker/                 Cloudflare Worker (ICS proxy), wrangler.toml, tests
android/                Android project (Capacitor, HomeWally)
scripts/                fetch the symbol and weather icon sets
```
