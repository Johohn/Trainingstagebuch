Build a simple, modern workout diary app called "Trainingstagebuch" for my Android phone. It is for personal use only (no production, no app store), so keep it simple and easy to install.

## Tech approach
- Progressive Web App (PWA): plain HTML, CSS and vanilla JavaScript. No framework, no build step, no backend.
- Files: index.html, style.css, app.js, manifest.webmanifest, service-worker.js, plus app icons (192x192 and 512x512 PNG, also a maskable version). Generate the icons yourself (e.g. a simple SVG-based or script-generated icon: rounded square with a flame or dumbbell symbol on a gradient).
- The app must work fully offline (service worker caches all assets) and be installable via Chrome on Android ("Zum Startbildschirm hinzufügen"). Set up the manifest correctly (name "Trainingstagebuch", short_name "Training", standalone display, theme color, portrait orientation, lang "de").
- Data is stored in localStorage as a JSON object keyed by date (YYYY-MM-DD) -> array of workout type IDs.

## Language
Everything in the UI must be in German (labels, month names, weekday names, buttons, messages). Weeks start on Monday (Mo, Di, Mi, Do, Fr, Sa, So).

## Purpose
I play Ultimate Frisbee and want to log which kind of workout I did on which day. No sets, reps or weights. Just a calendar that shows what I did when.

## Workout types and colors
Each type has its own distinct color, used consistently everywhere (calendar, buttons, legend, stats):
- Werfen – blue (#3B82F6)
- Ausdauer – green (#22C55E)
- Field Workout (Cuts, Agility) – orange (#F97316)
- Beinkraft – purple (#A855F7)
- Oberkörper Kraft – red (#EF4444)
- Sonstiges – slate/teal gray (#64748B)
Store the types in a single config array in app.js so they are easy to change later.

## Features
1. Main screen: a month calendar view.
   - Header with the month and year (e.g. "Oktober 2026") and previous/next month buttons. Swiping left/right should also change the month.
   - A "Heute" button to jump back to the current month.
   - Today's date is highlighted.
   - Every day cell shows small colored dots (one per workout type done that day, max 6) so I can see at a glance what I did.
2. Tap a day -> a bottom sheet (modal) opens:
   - Shows the date in German (e.g. "Donnerstag, 1. Oktober").
   - Lists all 6 workout types as large, colorful toggle chips/buttons. Multiple types can be selected on the same day.
   - Selection is saved immediately (or via a clear "Speichern" button, your choice, but keep it quick: ideally 2 taps to log a workout).
   - Close by tapping outside, swiping down or a close button.
3. Legend below the calendar showing the color for each workout type.
4. Simple monthly summary below the legend: per workout type, how many days in the shown month (e.g. colored bar or chip with the count) and total training days.
5. Backup: a small settings/menu with "Daten exportieren" (download JSON file) and "Daten importieren" (load JSON file), since localStorage can get lost. Confirm before overwriting data on import.

## Design
- Modern, clean, mobile-first (designed for ~360-430px wide screens, but it should also look fine on desktop).
- Rounded corners, soft shadows, generous spacing, smooth transitions/animations (e.g. bottom sheet slide-up, chip toggle animation).
- Support light and dark mode automatically via prefers-color-scheme (use CSS variables).
- Use a system font stack or a clean font; no external CDNs or dependencies, everything must work offline.
- Touch targets at least 44px. Use safe-area insets and a theme-color meta tag so it looks native when installed.

## Code quality
- Keep the code small, readable and commented where useful.
- No external libraries.
- Handle edge cases: empty days, month lengths, leap years, leading/trailing days of neighboring months (show them dimmed or empty), localStorage errors.

## Deliverables
1. All app files in a project folder.
2. A short README.md (in German) explaining:
   - how to test locally (e.g. `python3 -m http.server` or `npx serve`),
   - how to deploy for free on GitHub Pages step by step,
   - how to install it on an Android phone via Chrome ("Zum Startbildschirm hinzufügen"),
   - how to export/import a backup.
3. Test the app logic as far as possible (e.g. calendar generation for different months, Monday-first layout) and tell me what you verified.

Start by briefly outlining your plan, then implement everything.