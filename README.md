# HomeWally – Family Calendar

A digital wall calendar for the family. It runs entirely in the browser (e.g. on an iPad mounted on the wall), with no
sign-in and no server of your own. Website: <https://indigo-dev.github.io/homewally/>

The same code also ships as the Android app and home-screen launcher **HomeWally** (see [Android app](#android-app-homewally)).

- **Calendars via subscription link (ICS):** Google, Microsoft personal (Outlook.com/Live), Microsoft 365 (work/school),
  iCloud and any other iCal link. No sign-in, nothing expires.
- **Calendars separate from people:** Under Settings → Calendars you add subscription links, give each calendar a name
  and assign it to one or more people. Deleting a person keeps their calendars.
- **Public and school holidays** for all German states (OpenHolidays API) – independent of people, shown as markers in
  the calendar, can be switched on/off in the settings.
- **Family members** with name, colour and avatar (initials, emoji or photo).
- **Timetable** as a separate module: per child Mon–Fri × school periods with bell times, subjects in colours (presets
  for primary and secondary school, custom ones possible), filled in with a paint mode. Today and the current period are
  highlighted; on public holidays and during school holidays the day is greyed out. Switch it on under Settings → Family;
  bell times and colours under Settings → School.
- **Views:** day, week, month, year, agenda – swipe left/right to page.
- **Person filter:** tap an avatar to show only that person (tap again or “All” = everyone). Long-press adds or removes
  a person.
- Identical events in several calendars are merged into one event with several colours.
- **Export/import** of the configuration as JSON (Settings → Backup).
- Wall mode: screen stays on, jumps back to “Today” after inactivity, auto-refresh, offline cache.
- **Demo events** to try it out.

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

1. <https://dash.cloudflare.com> → Workers & Pages → Create → “Start with Hello World”, name `familienkalender-ics`,
   Deploy.
2. “Edit code”, replace everything with the contents of `worker/worker.js`, Deploy.
3. Optionally set `ALLOWED_HOSTS` / `ALLOWED_ORIGINS` under Settings → Variables.

Then enter the address (`https://familienkalender-ics.<name>.workers.dev`) in the app under
**Settings → Calendars → Proxy** and click “Save & test”.

### Access key (recommended)

Without a key, anyone who knows the worker address can use it as an ICS proxy. With a key, the worker only serves your
own app:

1. Set a long random value as the secret `ACCESS_KEY` – `npx wrangler@4 secret put ACCESS_KEY --config worker/wrangler.toml`
   or in the dashboard under Settings → Variables and Secrets (type “Secret”).
2. Enter the same value in the app under **Settings → Calendars → Proxy** in the “Key” field and click “Save & test”.
   Needed on every device (or transfer it via backup).

Order when upgrading from an older version: deploy the new worker first, then set the key. The app works with both the
old and the new worker.

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

## Android app (HomeWally)

The Android app wraps the same web code with [Capacitor](https://capacitorjs.com) and can be set as the tablet's home
screen (launcher), including an “Apps” module that lists and starts installed apps.

- Native project: `android/`; configuration: `capacitor.config.ts` (package name `io.github.indigodev.homewally` –
  fixed in the Play Store, never change it).
- Build locally: `npm run build`, then `npx cap sync android` and open `android/` in Android Studio.
- The workflow `.github/workflows/android.yml` builds a signed AAB on every push to `main` and uploads it to Google Play
  (internal testing), so the tablets update themselves. Required repository secrets are listed at the top of the
  workflow file.

## Set up the iPad

- Open the page in Safari → Share → **Add to Home Screen**.
- Transfer the configuration from the computer: there Settings → Backup → Export, move the file to the iPad
  (AirDrop/iCloud) and import it.
- For wall use: Settings → Accessibility → enable **Guided Access**, open the app, triple-click the side button → Start.
- Auto-lock is prevented via the Wake Lock API (iPadOS ≥ 16.4); on older devices set Auto-Lock to “Never”.

## Configuration & privacy

- Everything (people, calendar links, settings, event cache) is stored only in the device's `localStorage`.
- The export contains the secret calendar links and the proxy key – don't share it.
- Public/school holidays: [OpenHolidays API](https://www.openholidaysapi.org), licence ODbL.

## Project structure

```
src/
  main.tsx              entry point
  App.tsx               layout, navigation, auto-refresh, wall mode
  store.tsx             configuration (people, calendars) + person filter
  lib/ics.ts            iCal parser incl. recurring events and time zones
  lib/events.ts         load subscription links via the proxy, merge, cache
  lib/holidays.ts       public/school holidays (OpenHolidays API)
  lib/demo.ts           demo events
  lib/config.ts         defaults, migration, export/import, avatar images
  views/                day/week, month, year, agenda
  settings/             settings dialog
  native/               bridge to the Android app (launcher, direct calendar fetch)
worker/                 Cloudflare Worker (proxy), wrangler.toml, tests
android/                Android project (Capacitor, HomeWally)
```
