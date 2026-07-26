# Home Plate

A household meal-planning PWA: set dietary preferences, tag meals by effort/size, plan
breakfast/lunch/dinner (dinner split into separate adult and kids meals), get warned when a
dinner repeats within any 7-day window, browse a 6-week-back/3-month-ahead calendar, and
auto-generate a shopping list grouped by aisle. Syncs between household members via Google
Drive — no accounts, no server.

Built with the same stack as Media Journal: Vite + React + TypeScript + MUI + Dexie
(IndexedDB) + react-router-dom.

## Getting started

```bash
npm install
npm run dev
```

Data is stored locally in IndexedDB via Dexie — nothing leaves the device until you connect
Google Drive in Settings.

## Google Drive setup (required for sync)

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

Household members don't need separate Google accounts tied to each other — anyone can connect
their own Drive, export, and others import the file from the shared **Home Plate** folder.
There's no login system in the app itself; the household code in Settings is just a shared
label to keep everyone's exports recognizable, not an auth mechanism.

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
    googleDrive/    Drive OAuth + export/import
  hooks/            useAutoBackup, useBooleanSetting
  components/
    layout/         AppHeader (title + settings gear), BottomNav, AppLayout
    planner/        DayCard, MealPickerDialog
    settings/       CollapsibleSection, GoogleDriveSection, HouseholdSection, DietaryDefaultsSection
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
