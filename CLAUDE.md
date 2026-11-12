# The Classic (swclassic)

Annual golf tournament site (Team Red vs Team Blue): live scoring, draft, leaderboard, history, rules. Served at theclassicgolf.org.

## Stack
- Static site: hand-written HTML + vanilla browser JS (no framework, no bundler, no TypeScript, no package.json)
- Backend: Vercel serverless functions in `api/*.js` (CommonJS, `module.exports = async function handler(req, res)`, global `fetch`)
- "Database": JSON files committed to GitHub (`data.json` live scoring, `history-data.json` archive), read/written via the GitHub Contents API on branch `main`
- Hosting: Vercel (`vercel.json` only sets no-cache headers). PWA via `sw.js` + `manifest.json`
- TODO: confirm Node runtime version on Vercel (not pinned in repo)

## Layout
- Root: one `<page>.html` + `<page>.js` pair per page (`index`, `leaderboard`, `draft`, `history`, `admin`, `classic-2026`, `rules`)
- `teams.js` shared team model (`ClassicTeams(data)`); `matchup-modal.js` shared modal; `weather.js` weather client
- `api/data.js` GET live data; `api/save.js` POST writes; `api/weather.js` OpenWeatherMap proxy
- `css/styles.css` single stylesheet (cache-busted via `?v=` in `sw.js` SHELL and HTML)
- `images/players/`, `icons/` assets
- Tests: none found. Lint/format config: none found.

## Commands
- No install or build step. Dev: TODO: confirm (likely `npx vercel dev` for `/api`, or any static server for the front end)
- Test: none. Lint: none. Build: none
- Deploy: TODO: confirm (appears to be Vercel git auto-deploy from `main`)
- Env vars needed by functions: `GITHUB_TOKEN`, `ADMIN_PASSWORD_HASH`, `OPENWEATHER_API_KEY`

## Conventions
- Team slot keys are legacy: `"green"` slot = Team Red, `"red"` slot = Team Blue. Never rename keys; use `ClassicTeams` for labels/colors
- Player `team` is `"green" | "red" | null`; captains have `captain: true`
- Format (2027+): 2v2 pairs, one match per foursome/group. Field size is a setting, `meta.format.playersPerTeam` (players per team incl. captain; unset = matches*2; 6 if the field is short, 8 if full), changed from admin Event Setup ("Players per team"), which resizes `data.matches` to teamSize/2. Read it via `ClassicTeams.teamSize/pickLimit/pickCount(data)`; never hard-code 6 or 8. Draft picks = 2*(teamSize-1); signed-up players beyond that are alternates. Front 9 is a scramble, back 9 is alternate shot, no handicap strokes (pops are draft seeds only). A match has `playerIds: [redLead, blueLead]` (side 0 = `"green"` slot, side 1 = `"red"` slot) plus `partnerIds: [redPartner, bluePartner]`. Team/side lookups use the lead in `playerIds`; always read both players via `ClassicTeams.pairIds(match, side)` / `ClassicTeams.pairName(...)`. Hole results in `points.holes` are 1 = Red pair, 0 = Blue pair, 0.5 = halved, each match is worth 3 points: `points.front9`, `points.back9`, and `points.total` (overall 18: the pair with more holes won across all 18, `calculateNineFromHoles(holes, 1, 18)`; play on after a nine is clinched since holes still count toward the total; older archived matches have no `total`, so readers skip nulls — use `ClassicTeams.POINT_KEYS`). Mulligans are one per pair per nine. Roster placeholders use ids `tbd1`/`tbd2` (name "TBD n") until real players commit
- Home page Draft Board tile (`#draft-tile` in `index.html`) is temporary and annual: it reads the live roster (captains, ranks, pops, `team`) and polls every 15s, so it follows picks saved from the admin Draft tab. It hides itself (and stops polling) once any match has `playerIds` set, i.e. when pairings are built. It sizes itself from `meta.format.playersPerTeam`
- Pages load data from `/api/data` first, falling back to `./data.json`, with `?t=Date.now()` and `cache: "no-store"`; localStorage caches data for offline
- Saves go through `/api/save`: foursome scorers send `{foursome: 0-3}` (server merges only `matches[foursome]`, the group's one match; 4 scorer tokens exist, extras are unused at 6v6); admin sends a full doc with `expectedLastUpdated` (optimistic lock, 409 on mismatch). Preserve this concurrency model
- Escape user-provided strings with `escapeHTML` before inserting into innerHTML
- Errors in API: JSON `{ error: "..." }` with proper status; storage access wrapped in `try/catch`
- Style: 2-space indent, double quotes, semicolons, camelCase; mixed `var`/`const`/`let` (older files use `var`)

## Never
- Never hand-edit `data.json` during a live round (the API commits to it; manual edits cause SHA/lastUpdated conflicts)
- Never commit secrets (`.env`, tokens, API keys); `.vercel` and `node_modules` are gitignored
- Never add files to `ALLOWED_FILES` in `api/save.js` without a reason; only `data.json` and `history-data.json` are writable
- Never change `meta.foursomeTokens` / password hash logic casually (auth)
- After changing any shell file (HTML/JS/CSS) that `sw.js` caches, bump `CACHE_VERSION` in `sw.js` so clients refresh
- TODO: confirm whether `ADMIN_PASSWORD_HASH` in `admin.js`/`api/save.js` (legacy fallback) should be removed or left
