# Sinergia Calendar (ICS Generator)

Dynamic ICS calendar generator for Sinergia Life with a minimal frontend to subscribe or download calendars per activity, or all activities.

## Features
- Serverless endpoints under `api/` (compatible with Vercel)
- Local Express server for easy local development
- Fetches all activity types, merges schedules, and generates a unified ICS
- Per-activity ICS via `id` param (single or comma-separated)
- In-memory caching of external API responses with configurable TTL
- Frontend UI to multi-select activity groups (grouped by name) and generate links

## Requirements
- Node.js 18+ recommended (local server auto-polyfills `fetch` via `undici` if needed)
- npm

## Getting Started (Local)
1. Install dependencies:
```bash
yarn install # or: npm install
```
2. Run the local server:
```bash
npm run dev
```
3. Open the frontend:
```text
http://localhost:3000/
```

## Endpoints
### GET /api/types
Returns active activity types (optionally filtered by company) and disables caching via headers.
- Response: `{ types: [...], companyId: string }`
- Headers: `Cache-Control: no-store, no-cache, must-revalidate`

Query params:
- `cId` (string): company id. Defaults to `COMPANY_ID_DEFAULT` or `5`.
- `cacheMinutes` (number): cache TTL in minutes (default `5`).
- `nocache=1`: bypass in-memory cache.

### GET /api/calendar
Returns an ICS file generated from schedules. If `id` is omitted, merges all activities (filtered by company).
- Content-Type: `text/calendar; charset=utf-8`
- Disposition: attachment, `sinergia-calendar.ics`

Query params:
- `id` (string): single id or comma-separated ids (e.g. `id=134` or `id=134,145`). If omitted, all activities.
- `cId` (string): company id (default `COMPANY_ID_DEFAULT` or `5`).
- `cacheMinutes` (number): cache TTL in minutes (default `5`).
- `nocache=1`: bypass in-memory cache.

## Frontend
Served from `public/` at `/`.
- Groups activities by name (title-cased)
- Checkbox per group; Select all / Clear controls
- Subscribe button is enabled only when at least one group is selected
- Download supports all or selected

URL options (appended to page URL and propagated to API calls):
- `?cId=5&cacheMinutes=5` or `?nocache=1`

## Configuration
Environment variables:
- `COMPANY_ID_DEFAULT` (string): Default company id for filtering activities. Defaults to `5` if not set.

Set locally (bash):
```bash
export COMPANY_ID_DEFAULT=5
```

## Caching
- External API responses are cached in-memory (per-process) for `cacheMinutes` (default 5 minutes).
- Bypass with `?nocache=1`.
- Logs include cache HIT/MISS and fetch timings for visibility.

## Scripts
- `npm run dev` → start local Express server on port 3000
- `npm run build` → Vercel build (for deployment)
- `npm run deploy` → Vercel deploy

## Deployment (Vercel)
- Serverless functions live in `api/` (`api/calendar.js`, `api/types.js`)
- Static frontend is in `public/`
- `vercel.json` can be extended as needed; `maxDuration` is set for `api/calendar.js`

## Troubleshooting
- Port already in use (EADDRINUSE):
```bash
lsof -i :3000 -sTCP:LISTEN -n -P | awk 'NR>1 {print $2}' | xargs -r kill -9
```
- Stale frontend showing “Failed to load activity types.”
  - Ensure the server is running
  - The backend sets no-store headers; the frontend fetch uses `cache: 'no-store'`
  - Try `?nocache=1` in the page URL
- Slow first load: external API may take ~1–2s on first fetch; subsequent requests should be cached.

## Notes
- Consider moving any secrets/tokens to environment variables before public deployment.
