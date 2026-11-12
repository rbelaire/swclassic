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
- Pages load data from `/api/data` first, falling back to `./data.json`, with `?t=Date.now()` and `cache: "no-store"`; localStorage caches data for offline
- Saves go through `/api/save`: foursome scorers send `{foursome: 0-3}` (server merges only that foursome's matches); admin sends a full doc with `expectedLastUpdated` (optimistic lock, 409 on mismatch). Preserve this concurrency model
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
