# Home Plate

A household meal-planning PWA: set dietary preferences, tag meals by effort/size, plan
breakfast/lunch/dinner (dinner split into separate adult and kids meals), get warned when a
dinner repeats within any 7-day window, browse a 6-week-back/3-month-ahead calendar, and
auto-generate a shopping list grouped by aisle. No backend and no individual accounts —
household members stay in sync by exporting/importing the same file via Google Drive, and
recognize each other via a shared household code shown in Settings.

Built with the same stack as Media Journal: Vite + React + TypeScript + MUI + Dexie
(IndexedDB) + react-router-dom.

## Getting started

```bash
npm install
npm run dev
```

Data is stored locally in IndexedDB via Dexie — nothing leaves the device until you connect
Google Drive in Settings.

## Google Drive setup (required for household sync)

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

To share a plan: one person connects Drive and exports; other household members connect their
own Drive account and use **Import from Drive** to pull that same file in. The household code
shown in Settings → Household is just a shared label so everyone recognizes the same export —
there's no account or server behind it. Repeat the export/import whenever the plan changes;
the optional automatic daily backup (also in Settings) makes this easier by keeping one
device's export always current.

## Recipe import via URL setup (optional)

Importing a recipe by pasting a link (Library \u2192 Import from URL) needs a small Cloudflare
Worker to fetch pages on the app's behalf, since browsers can't fetch arbitrary cross-origin
pages directly. Without this set up, the button still shows but importing will show a
"not set up yet" error \u2014 nothing else in the app is affected.

1. Deploy `cloudflare-worker/recipe-import-worker.js` as a Cloudflare Worker \u2014 see the
   deploy steps in that file's header comment (dashboard-only, no local tooling needed).
2. Copy the Worker's `*.workers.dev` URL.
3. Set it as `VITE_RECIPE_IMPORT_WORKER_URL` \u2014 same way as `VITE_GOOGLE_CLIENT_ID` above
   (local `.env` for dev, GitHub Actions repo secret for the deployed build).

The app only ever sends it a page or image URL to fetch \u2014 no recipe or household data passes
through it.

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
    database/       Dexie schema
    mealPlan/       Repeat-check logic, shopping list generation, meal stats
    googleDrive/    Drive OAuth + export/import (the household sync mechanism)
  hooks/            useAutoBackup, useBooleanSetting
  components/
    layout/         AppHeader (title + settings gear), BottomNav, AppLayout
    planner/        DayCard, MealPickerDialog
    settings/       CollapsibleSection, HouseholdSection, GoogleDriveSection, DietaryDefaultsSection
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
