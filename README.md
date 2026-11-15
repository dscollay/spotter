# Spotter

A family home-gym workout log for Dan, Bonnie, and Audrey. It runs in the browser, stores everything in IndexedDB on the device, and builds to a static folder.

There is no account and no server. If the browser clears site data, the log goes with it, so export a backup after sessions that matter.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints. Use a phone-sized window. The shipped programs are placeholders named `placeholder - replace with coach program`. Replace them from the Program tab before real training.

```bash
npm run check
npm run build
npm run preview
```

`check` typechecks and validates the placeholder programs. `preview` serves the production build, including the service worker.

## Program file

One program per person. Unknown fields are ignored. `reps` or `work_sec` is set, and the other is null.

```json
{
  "profile": "bonnie",
  "program_name": "block 1",
  "start_date": "2026-11-16",
  "sessions_before_new_program": 18,
  "days": [
    {
      "name": "day 1",
      "warmup": "optional text",
      "deload": false,
      "circuits": [
        {
          "label": "a",
          "rounds": 3,
          "rest_between_rounds_sec": 90,
          "exercises": [
            {
              "slot": "a1",
              "name": "goblet squat",
              "sets": 3,
              "reps": "8-10",
              "work_sec": null,
              "load": "12 kg",
              "unit": "kg",
              "rpe": 7,
              "tempo": "3010",
              "rest_sec": 30,
              "video_url": "https://example.com/video",
              "notes": "cues"
            }
          ]
        }
      ]
    }
  ],
  "progression_rule": "plain text"
}
```

Days rotate in order: day 1, day 2, then day 1 again. A circuit is its exercises repeated for `rounds`. After an exercise the app rests for `rest_sec`. After the last exercise of a round it rests for `rest_between_rounds_sec` instead (or `rest_sec` when that round rest is 0). Nothing rests after the final exercise. Timers start only when you tap Start.

Import from the Program tab by file or paste. The `profile` field chooses whose program it replaces. Old sessions stay in History.

## Backup

Data → Export backup downloads a JSON file of every profile. Import can merge (add workouts that are not already here, and keep a program that is already on the device) or replace (delete this device's log, then load the file). Confirm either one.

The app asks the browser for persistent storage. It shows the last backup date and a reminder when that is missing or older than 7 days.

## Deploy

The site is [https://dscollay.github.io/spotter/](https://dscollay.github.io/spotter/). A push to `main` runs `.github/workflows/pages.yml`: it builds with `VITE_BASE=/spotter/` and publishes `dist/` with `actions/upload-pages-artifact` and `actions/deploy-pages`. In the repository settings, Pages source is GitHub Actions.

`npm run build` without `VITE_BASE` keeps relative paths (`./`) for a host that serves the site at the domain root. To preview the Pages build locally:

```bash
VITE_BASE=/spotter/ npm run build
VITE_BASE=/spotter/ npm run preview
```

Open `http://localhost:4173/spotter/`.

Add the installed page to the home screen from iOS Safari (Share → Add to Home Screen) or Android Chrome (Install app). The service worker caches the app shell so a loaded install still opens offline. The workout log itself is in IndexedDB, not in the cache.

## Phone notes

Beeps use the Web Audio API and stay silent on iOS until a tap unlocks audio. The first Start does that.

The screen stays awake through the Screen Wake Lock API while a workout is open. If the browser refuses, Spotter plays a tiny silent video as a fallback and says so when that also fails.
