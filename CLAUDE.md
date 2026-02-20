# CLAUDE.md

WRSR Calculator — a building cost calculator for Workers & Resources: Soviet Republic. Parses game data files (.ini/.bbox/.btf) and provides a web interface for browsing buildings and planning construction projects.

# Docs
## Commands

```bash
make dev              # Runs both servers together (Ctrl-C kills both)
make backend          # Flask on :5000 only (hot-reloads on file change via --debug)
make frontend         # Vite on :5173 only, proxies /api to :5000
make reimport            # Reimport game data from known install path
make import ARGS="--game-dir /path/to/wrsr"  # Import from custom path
make migrate          # Run DB migration (uv run python backend/migrate_add_countries.py)
cd frontend && npm run lint
cd frontend && npm run build
cd frontend && npm run test         # Vitest unit tests (jsdom, fast)
cd frontend && npm run test:browser # Vitest UI + headed Firefox (visual debugging)
cd backend && uv run pytest         # Backend tests
```

## Tech Stack

- **Backend:** Flask + SQLAlchemy + SQLite, managed with uv (Python 3.13+)
- **Frontend:** React 19 + Vite + React Router, managed with npm
- **Database:** SQLite at `backend/data/wrsr.db`, tracked in git (committed with game data)
- **Styling:** Custom Windows 95 theme (`src/win95.css`) — no CSS frameworks
- **API reference:** [API.md](API.md)

## Conventions

### UI / CSS
- Win95-styled classes from `src/win95.css` (`.win95-window`, `.win95-btn`, `.win95-input`, `.win95-table`, `.win95-tab`, `.win95-dialog`, `.win95-side-panel`, etc.)
- Raised/sunken 3D borders, gray backgrounds (#c0c0c0), blue title bars, inset panels
- Win95-styled dialogs (`.win95-dialog-overlay` + `.win95-dialog`) — never browser `prompt()`/`confirm()`
- Win95-styled side panel (`.win95-side-panel` + `.win95-side-panel-body`) — fixed right-side window with titlebar
- Building names display `source_file` alongside (smaller, greyed out via `win95-muted`) to disambiguate duplicates
- Never use Bootstrap or other CSS frameworks

### React
- Hooks for state (no Redux/Context)
- Never nest component definitions — use render helpers (e.g. `renderSortHeader()`)
- API calls through `frontend/src/api.js` fetch wrapper
- `<label htmlFor="id">` + `<select id="id">` required for `getByRole('combobox', { name: /Label/i })` in tests

### Backend
- Flask blueprints in `app/routes/`, factory in `app/__init__.py`
- Manual `get_session()` / `session.close()` in try/finally (no Flask-SQLAlchemy)
- Models serialize via `to_dict()` methods
- BuildingCost `phase`: `"construction"` or `"operation"`
- BuildingFlow `direction`: `"produces"` or `"consumes"`
- Building search matches on both `name` and `source_file` (OR, case-insensitive)
- Use `session.execute(sql_delete(Model).where(...))` + `session.flush()` for bulk deletes before inserts — ORM `session.delete()` per-row can cause ordering issues that violate UNIQUE constraints

### Countries
- `Country` model: `{ id (UUID), name, created_at }` — top-level container for projects + prices
- `CountryResourcePrice`: `{ country_id, resource_id, price }` UNIQUE(country_id, resource_id)
- Country selector in taskbar (persistent global context); auto-selects first country on load
- Country delete blocked if it has any projects (returns 409); cascade deletes prices
- `GET/PUT /api/countries/<id>/prices` — bulk-replace, zero/null discarded
- Migration: `backend/migrate_add_countries.py` — run once with `make migrate`

### Projects
- Stored in backend SQLite (`Project` + `ProjectBuilding` models)
- `Project` now has nullable `country_id` FK; no longer has per-project prices
- `frontend/src/projectStorage.js` — async wrappers; `loadProjects(countryId)`, `createProject(name, countryId)`
- Shape: `{ id, name, country_id, buildings: [{ buildingId, quantity, position }] }`
- `position` field preserves order and serves as key for update/delete API calls
- `GET /api/projects?country_id=<id>` — filter by country
- Prices are per-country (shared across all projects in a country): `App.jsx` owns `countryPrices` state, fetches on country switch, passes to `ProjectView` as `prices` prop
- Resource Prices live in a **taskbar-toggled side panel** (Prices button, right of CountrySelector); accessible from any page
- `ResourcePrices` component accepts `countryId` + `prices` + `onUpdatePrices`; fetches its own project data via `loadProjects(countryId)` to derive used resources; auto-saves with 600ms debounce (no Save button)
- Resource name shown as `Name (unit)` — no separate Unit column
- CostCalculator uses single column per resource: unit amount on top, ruble cost as navy sub-line (`#000080`, `0.85em`) when prices set. Footer `<tfoot>`: row 1 unit totals (grey), row 2 per-resource ruble totals (grey + navy, `—` for unpriced), row 3 grand total (colSpan label + value in last column)

### Testing
- **Frontend unit:** Vitest + @testing-library/react + jsdom. Tests: `src/components/*.test.jsx`
- **Frontend browser:** Vitest browser mode + Playwright + Firefox. Loads `win95.css`, disables auto-cleanup (`RTL_SKIP_AUTO_CLEANUP`), 2s delay between tests for visual inspection. Setup: `src/browser-test-setup.js`
- **Backend:** pytest with in-memory SQLite. Tests: `backend/tests/`
- Test cleanup is handled by setup files (`test-setup.js` / `browser-test-setup.js`), not in test files
- For debounce testing: use real timers with `userEvent.setup({ delay: null })` + `waitFor(..., { timeout: 2000 })` — avoid `vi.useFakeTimers()` before render as it blocks `waitFor` polling

## Architecture

### Navigation
- **Info** section: Buildings list (`/`), Building detail (`/buildings/:id`)
  - BuildingList has two tabs: **Construction** (sparse resource columns + material filter) and **Production** (flow buildings only, ↑↓ annotations, direction + resource filters)
  - BuildingDetail has compact header (category/workers/days/source), Construction Costs groupbox, Operation groupbox (operation costs + production flows with ↑ Produces / ↓ Consumes rows)
- **Planning** section: Projects (`/projects`) — tabbed Construction Costs / Operation Costs
- **Resource Prices** panel: toggled by "Prices" button in taskbar; fixed right-side panel (`win95-side-panel`), available on all pages

### Data Models
- `Building` → `BuildingCost` (phase: construction/operation) + `BuildingFlow` (direction: produces/consumes)
- `BuildingFlow`: `building_id`, `resource_id`, `quantity`, `direction` — stored in `building_flows` table
- `GET /api/buildings` returns sparse `produces`/`consumes` dicts (resource_id → quantity) per building
- `GET /api/buildings/:id` returns full `flows` array via `to_dict(include_flows=True)`

### Game Data Extractor (`backend/extractor/`)
- `parser.py` — parses `.ini` building files and `.bbox` geometry. Auto-computes costs via `AUTO_DICT`. `parse_building` accepts optional `source_file` override for DLC disambiguation. Exposes `pb.production` and `pb.consumption` dicts for flows.
- `importer.py` — CLI entry point (`python -m extractor.importer`). Clears and reimports all data (including `building_flows`). When `--game-dir` is used, also scans `media_soviet/dlc*/buildings/` for DLC buildings (nested structure: `<dlc>/buildings/<subdir>/building.ini`). DLC buildings get `source_file` like `dlc3/airport_terminal_small`.
- `translations.py` — parses binary `.btf` translation files (UTF-16 BE) for display names.
- Reference parser at `reference/workers_and_resources/` documents the game file format.
- `reference/building_samples/` — 216 `.ini` files for all buildings with duplicate display names (copied from game data). Useful for analysing what directives (`$TYPE_`, `$STORAGE`, `$CITIZENS`, `$STYLE_FLAG`, etc.) can distinguish same-named buildings.

## Upcoming Work

- **Project import/export** — JSON download/upload for sharing projects
- **Building detail enrichment** — storage capacity, vehicle compatibility (production flows already shown)
- **Resource summary dashboard** — aggregate view across all projects
- **Operation cost rates** — per-day/per-cycle normalization for ongoing expense planning
