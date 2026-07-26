# Home Plate

A household meal-planning PWA: set dietary preferences, tag meals by effort/size, plan
breakfast/lunch/dinner (dinner split into separate adult and kids meals), get warned when a
dinner repeats within any 7-day window, browse a 6-week-back/3-month-ahead calendar, and
auto-generate a shopping list grouped by aisle. Syncs between household members in real time
via Dexie Cloud (email sign-in, no passwords), with Google Drive export/import kept as an
optional manual backup on top.

Built with the same stack as Media Journal: Vite + React + TypeScript + MUI + Dexie
(IndexedDB) + react-router-dom.

## Getting started

```bash
npm install
npm run dev
```

Data is stored locally in IndexedDB via Dexie — nothing leaves the device until you sign in
for household sync (or connect Google Drive) in Settings.

## Dexie Cloud setup (required for household sync)

1. Run `npx dexie-cloud create` in the project root — this provisions a free Dexie Cloud
   database and prints a database URL (`https://<your-db>.dexie.cloud`).
2. Create a `.env` file in the project root (copy `.env.example`) and set:
   ```
   VITE_DEXIE_CLOUD_URL=https://your-db.dexie.cloud
   ```
3. Restart `npm run dev` after adding the `.env` file.

That's it — no further dashboard config is needed for the free tier (3 users, 100MB, which
comfortably covers a household). In Settings → Household, sign in with your email (a one-time
code is emailed to you, no password), tap **Set up household sync** to create your household's
shared space, then **Invite** your household by email. Once they accept, both devices sync
live and Home Plate works fully offline in between — changes queue locally and sync when back
online.

The database URL isn't secret (it only allows email/OTP sign-in against your own database), so
it's fine to bake into your deployed build's environment, the same as the Google Drive client
ID below.

## Google Drive setup (optional backup)

The app uses Google Identity Services with the narrow `drive.file` scope — it can only see
files it creates itself, never anything else in your Drive.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/), create a project (or
   use an existing one).
2. **APIs & Services → Library** — enable the **Google Drive API**.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Under **Authorized JavaScript origins**, add the origin(s) you'll run the app from
     (e.g. `http://localhost:5173` for dev, and your GitHub Pages / hosting URL for
     production).
4. Copy the generated **Client ID**.
5. Create a `.env` file in the project root (copy `.env.example`) and set:
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   ```
6. Restart `npm run dev` after adding the `.env` file.

Each household member repeats step 5 locally, or you bake the client ID into your deployed
build's environment — the client ID itself isn't secret (it's visible in any OAuth web app),
so it's fine to include in your deployed site's build config.

This is independent of household sync above — each person who wants a manual/automatic backup
connects their own Drive account and exports to their own **Home Plate** Drive folder. It's not
how household members share data with each other any more (that's Dexie Cloud); it's a personal
safety net.

## Deploying as a PWA via GitHub

1. Push this repo to GitHub.
2. Deploy with GitHub Pages (or any static host — Netlify/Vercel work too):
   - `npm run build` produces a static `dist/` folder.
   - For GitHub Pages specifically, you'll want to set `base` in `vite.config.ts` to your repo
     name (e.g. `base: '/home-plate/'`) and use a deploy action or `gh-pages` package.
3. Once deployed over HTTPS, the app is installable as a PWA (Add to Home Screen) on mobile
   and desktop.
4. Add your production URL to the OAuth client's **Authorized JavaScript origins** (step 3
   above) or Drive sign-in will fail on the deployed site.

## Project structure

```
src/
  theme/            MUI theme (pinky-purple palette, violet button/toggle accent)
  models/           Shared TypeScript types
  services/
    database/       Dexie schema + Dexie Cloud config, household realm cache
    householdSync/  Dexie Cloud login, household realm setup, invites
    mealPlan/       Repeat-check logic, shopping list generation, meal stats
    googleDrive/    Drive OAuth + export/import (manual backup, not primary sync)
  hooks/            useAutoBackup, useBooleanSetting, useHouseholdRealm
  components/
    layout/         AppHeader (title + settings gear), BottomNav, AppLayout
    planner/        DayCard, MealPickerDialog
    settings/       CollapsibleSection, HouseholdSyncSection, GoogleDriveSection, DietaryDefaultsSection
  pages/            WeeklyPlanner, Calendar, Library, EditMeal, ShoppingList, Settings
```

## Known follow-ups (not yet built)

- **Cooking mode**: recipe steps store an optional per-step timer (`timerSeconds`), but there's
  no dedicated full-screen "cooking mode" UI running the timers yet — the field is there for
  when that's built.
- **Leftover suggestions**: the data model supports marking a planned meal as `isLeftovers`,
  but the "suggest what to do with leftovers" prompt isn't implemented yet.
- **6-week history pruning**: history is kept indefinitely for now (per your call to decide
  the retention policy later) — nothing is auto-deleted.
- **"Would make again" filtering**: the flag is stored per meal but isn't yet surfaced as a
  filter/sort in the Library.
- App icons in `public/icons/` are placeholders — swap in real artwork before shipping.
