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
make migrate          # Run all DB migrations (countries + chains)
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

## Design Philosophy

### Functionality First
- Every element must earn its place by serving a user task (browsing buildings, planning projects, pricing resources)
- No decorative UI — all components exist to present or manipulate data
- Information density is preferred over whitespace; this is a data tool, not a landing page
- Keep controls close to their context: search above its results, totals below the table they summarize
- Immediate visual feedback on every action; avoid multi-step confirmations for reversible operations
- Auto-save where it makes sense (prices panel); avoid requiring explicit Save clicks

### Design Hierarchy Mirrors Data Model
- Visual structure reflects the domain hierarchy: **Country → Project → Building → Resource**
- Country is the outermost context — taskbar-level global selector, persists across all pages
- Projects are the primary work unit — own page, own tabs, own totals
- Buildings are items within projects — rows in tables, selected via search, navigable to detail pages
- Resources are attributes of buildings — sparse columns, never presented as standalone objects
- Navigation depth corresponds to model depth: list → detail (Buildings: list / building page)
- Nesting in the UI mirrors nesting in the data: groupboxes contain sub-sections the same way a project contains operation and construction phases

### Skeuomorphism
- Every interactive element should feel like a physical object that can be pressed or manipulated
- **Raised surfaces** (buttons, tabs, windows, toolbars): light top/left border, dark bottom/right border — protrudes toward the viewer
- **Inset surfaces** (inputs, scroll areas, table wrappers): dark top/left border, light bottom/right border — recedes from the viewer
- **Pressed/active states**: invert the border to simulate physical depression
- Dialogs are elevated above the desktop with a `4px 4px 0` drop shadow
- The side panel has a lateral shadow suggesting it slides over content from the right
- Windows float on a teal desktop background — the classic desktop metaphor
- Titlebar gradient (navy → lighter blue) signals window focus and ownership
- Non-functional titlebar buttons (─ □ ✕) are present as authentic window chrome

### Earlier-Computing Aesthetic
- Primary visual reference: **Windows 95 / Windows NT 4 era UI** — not Windows XP, not Metro
- Font: `MS Sans Serif` (Tahoma fallback) — no system-ui, no web fonts, no variable fonts
- Restricted color palette: `#c0c0c0` gray, `#000080` navy, `#008080` teal, `#ffffff`, `#000000`, `#808080` mid-gray
- No CSS transitions or animations — Win95 UI changes were instantaneous
- No rounded corners (Win95 had none on standard controls)
- No blur, gradients outside of title bars, or modern visual effects
- Pixel-precise borders (2px raised, 1px inset) — no anti-aliasing tricks
- Status bars at the bottom of content panels for counts and feedback (standard Win95 info strip)
- Dotted focus ring on default buttons (`outline: 1px dotted black; outline-offset: -4px`) — the Win95 default-button indicator

### Color Semantics
- **Navy `#000080`**: all primary interactive/active states — links, selected rows, title bars, ruble cost sub-lines
- **Gray `#c0c0c0`**: all neutral surfaces — backgrounds, buttons, borders
- **Teal `#008080`**: page/desktop background only — never used for content
- **Muted gray `#808080`**: secondary/contextual info — `source_file` labels, disabled states, units
- **Red `#c00000`**: negative values — net resource consumption in flow tables
- **Navy sub-line text**: secondary numeric info (ruble costs) rendered at `0.85em` in `#000080` beneath primary unit values

### Table Design
- Tables only render columns for resources/data that have ≥1 non-zero value (sparse columns) — reduces noise
- Sticky headers on all scrollable tables; sort arrows (`▲`/`▼`) on sortable columns
- Alternating row colors (`#ffffff` / `#f0f0f0`); hover inverts to `#808080` background with white text
- Selected rows use the same navy blue as hover for visual consistency
- Footer `<tfoot>` rows for totals; never inline sums in the last data row
- Numeric cells are right-aligned with tabular figures (`font-variant-numeric: tabular-nums`)
- Building names always show `source_file` alongside in smaller muted text to disambiguate duplicates

### Keyboard Navigation
- Search interfaces must be fully operable without a mouse: ↑↓ to navigate results, Enter to confirm, Tab to word-complete
- Selected row always scrolls into view automatically
- Text filter inputs accept typing immediately without requiring a button click

## Conventions

### UI / CSS
- Win95-styled classes from `src/win95.css` (`.win95-window`, `.win95-btn`, `.win95-input`, `.win95-table`, `.win95-tab`, `.win95-dialog`, `.win95-side-panel`, `.win95-search-results`, etc.)
- Raised/sunken 3D borders, gray backgrounds (#c0c0c0), blue title bars, inset panels
- Win95-styled dialogs (`.win95-dialog-overlay` + `.win95-dialog`) — never browser `prompt()`/`confirm()`
- Win95-styled side panel (`.win95-side-panel` + `.win95-side-panel-body`) — draggable, vertically resizable floating window; `App.jsx` owns `panelPos` (x/y) + `panelHeight` state; resize handle: `.win95-resize-s` at bottom
- `.win95-draggable-window` — `position:fixed`, `box-shadow: 4px 4px 0 #000`; titlebar gets `cursor:grab`/`grabbing` via `.dragging` class
- `.win95-resize-s` — 5px south resize handle with dotted grip; `cursor:ns-resize`; add to any vertically resizable panel/window
- `.win95-link-btn` — borderless button styled as a navy underlined link; used for building name cells that open the info popup instead of navigating
- `.win95-block-slider` / `.win95-block-slider-block` — generic 10-block fill widget; block is `position:relative; overflow:hidden`; inner fill `<div>` uses `position:absolute; width: fill%` for sub-step partial fill; used by `BlockSlider` component
- `.debt-calc-amount` — right-aligned tabular-nums cell for loan calculator results
- `.win95-combobox` / `.win95-combobox-display` / `.win95-combobox-arrow` / `.win95-combobox-list` / `.win95-combobox-option` — custom combo box styles
- `.win95-search-results` — always-visible in-flow fixed-height (200px) panel with inset border; uses `border-collapse: separate; border-spacing: 0` scoped override to fix Firefox sticky-header bug inside `overflow-y: auto` containers
- `.win95-table tr.selected td` — keyboard-selection highlight (same blue as hover); `.win95-table tr.selected .win95-muted` — light blue so source_file remains readable
- Building names display `source_file` alongside (smaller, greyed out via `win95-muted`) to disambiguate duplicates
- Never use Bootstrap or other CSS frameworks

### React
- Hooks for state (no Redux/Context)
- Never nest component definitions — use render helpers (e.g. `renderSortHeader()`)
- API calls through `frontend/src/api.js` fetch wrapper
- `<label htmlFor="id">` + `<select id="id">` required for `getByRole('combobox', { name: /Label/i })` in tests
- `BuildingConstructionTable` (`components/BuildingConstructionTable.jsx`) — shared Name + Category + sparse resource cost table. Sort mode (`onSort` prop): sortable headers, name cells are Links or `.win95-link-btn` buttons (when `onBuildingClick` provided). Select mode (`onSelect` prop): static headers, clickable rows. Used by `BuildingList` (sort mode) and `BuildingSearch` in `CostCalculator` (select mode).
- `BuildingInfoWindow` (`components/BuildingInfoWindow.jsx`) — draggable, vertically resizable floating popup; props `{ buildingId, onClose }`; fetches `GET /api/buildings/:id`; renders same content as `BuildingDetail`; titlebar drag via `mousemove`/`mouseup` on document; bottom `.win95-resize-s` handle. `App.jsx` owns `openBuildingId` state; passes `onBuildingClick={setOpenBuildingId}` to `BuildingList` and `ProjectView`; `ProjectView` threads it to `CostCalculator` and `IncomeAnalysis`.
- `WinComboBox` (`components/WinComboBox.jsx`) — custom Win95 combo box; props `{ items:[{id,label}], selectedId, onSelect, onRename, placeholder }`; single-click opens dropdown, double-click on display enters inline rename (input replaces label); Enter/blur commits rename, Escape cancels; click-outside closes. Used by `CountrySelector` (with `onRenameCountry` → `PUT /api/countries/<id>`) and `ProjectView` project picker (with `handleRenameProject` → `updateProjectAPI`).
- `DebtCalculator` (`components/DebtCalculator.jsx`) — floating Win95 loan calculator; toggled by "Loan" button in taskbar; `App.jsx` owns `showDebtCalc` state. Props: `{ onClose }`. State: `principal` (₽), `rateIdx` (0–10 → 0–5% in 0.5% steps), `termIdx` (0–10 → 0–5yr in 0.5yr steps). Uses `BlockSlider` (module-level) for rate/term. Position persisted to `localStorage('debt-calc-pos')`. Computes fixed-rate annuity; shows `—` when principal=0 or term=0. Results ordered Daily → Weekly → Monthly → Annual.
- `BlockSlider` (`components/BlockSlider.jsx`) — unified block-fill slider; props `{ min, max, step, value, onChange, blockCount=10, label, hasOverride, onClear }`; `label` is a string or `(v) => string`; partial fill within each block reflects sub-step precision; `hasOverride`+`onClear` render `×` clear button (for productivity overrides). Used by `DebtCalculator` (rate 0–5% step 0.1%, term 0–5yr step 0.1yr) and `IncomeAnalysis` (productivity 0–100% step 1%).
- `useDraggable` (`hooks/useDraggable.js`) — reusable drag hook; `useDraggable(initialPos)` → `{ pos, setPos, onMouseDown, isDragging }`; attach `onMouseDown` to titlebar; `initialPos` can be a lazy initializer function

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
- `CountryResourcePrice`: `{ country_id, resource_id, import_price, export_price }` UNIQUE(country_id, resource_id)
- Country selector in taskbar uses `WinComboBox`; double-click name to rename inline; auto-selects first country on load
- Country delete blocked if it has any projects (returns 409); cascade deletes prices
- `GET/PUT /api/countries/<id>/prices` — bulk-replace; format `{rid: {import: price, export: price}}`; entries where both are 0/null discarded
- `PUT /api/countries/<id>` — rename; `{ name }` required
- Migrations: `migrate_add_countries.py`, `migrate_add_import_export_prices.py` — run via `make migrate`

### Projects
- Stored in backend SQLite (`Project` + `ProjectBuilding` models)
- `Project` now has nullable `country_id` FK; no longer has per-project prices
- `Project.productivity` (float, default 1.0) — stored in DB but no longer exposed in the UI (was project-wide factor; superseded by per-building sliders)
- `ProjectBuilding.productivity` (float, nullable) — per-building staffing-level override (fraction of workers employed; null means 1.0)
- `frontend/src/projectStorage.js` — async wrappers; `loadProjects(countryId)`, `createProject(name, countryId)`
- Shape: `{ id, name, country_id, productivity, buildings: [{ buildingId, quantity, position, productivity }] }`
- `position` field preserves order and serves as key for update/delete API calls
- `PUT /api/projects/<id>` accepts `{ name?, productivity? }` — either field optional, but at least one required
- `PUT /api/projects/<id>/buildings/<pos>` accepts `{ quantity?, productivity? }` — either optional; productivity=null clears override
- Migration: `migrate_add_productivity.py` — adds `productivity` columns, run via `make migrate`
- `GET /api/projects?country_id=<id>` — filter by country
- Prices are per-country (shared across all projects in a country): `App.jsx` owns `countryPrices` state, fetches on country switch, passes to `ProjectView` as `prices` prop
- Prices are split into **import price** (cost to bring in a deficit) and **export price** (revenue from a surplus); `countryPrices` shape: `{ rid: { import: price, export: price } }`
- Resource Prices live in a **taskbar-toggled floating panel** (Prices button, right of CountrySelector); draggable via titlebar, vertically resizable via bottom edge; `App.jsx` owns `panelPos` + `panelHeight` state
- `ResourcePrices` accepts `countryId` + `prices` + `onUpdatePrices`; derives used resources from all cost/flow fields (`resource_costs`, `operation_costs`, `produces`, `consumes`); two price inputs per row (Import ₽ / Export ₽); auto-saves with 600ms debounce
- `CostCalculator` uses `prices[rid]?.import` (construction materials are imports); single column per resource: unit amount + navy ruble sub-line. Footer: unit totals row, ₽ totals row, grand total row
- `IncomeAnalysis` ruble calculations: net > 0 → use export price; net < 0 → use import price
- `BuildingSearch` (in `CostCalculator.jsx`): always-visible `.win95-search-results` panel (200px) above the project table; shows first 10 matches as a `BuildingConstructionTable`; arrow keys navigate, Enter adds, Tab completes next word of highlighted result's name

### Income Analysis (`components/income/IncomeAnalysis.jsx`)
Refactored into `components/income/` directory + two hooks:
- **`hooks/useProductivity.js`**: `useProductivity(projectId, projectBuildings)` — manages `buildingProductivityOverrides`, debounced DB saves, and `getNetFlow(b, pb, r, { applyProductivity, applyNormalize, period })`. Also exports `PERIODS` constant. No project-wide productivity state.
- **`hooks/useChains.js`**: `useChains(projectId)` — manages chain state + API calls; `autoDetectChains()` calls backend `POST /chains/auto-detect` → applies result via `bulkReplaceProjectChainsAPI`.
- **`components/income/IncomeAnalysis.jsx`** (orchestrator): uses both hooks; renders toolbar + "Resource Flows" groupbox + `ChainBuilder`.
- **`components/income/ResourceFlowsTable.jsx`**: per-building resource flow table with `BlockSlider` productivity controls. `showRubles` prop (default `true`) — when `false` hides the `₽ Net` column entirely (used by chain panels).
- **`components/income/ChainBuilder.jsx`**: chain list + auto-detect confirm dialog + ungrouped section. Module-level `ChainCard` sub-component manages its own `useEffect` to fetch chain economics from backend (keyed on members, period, overrides, normalizeView).
- **`components/income/ChainEconomicsPanel.jsx`**: purely presentational; receives `economics` from backend API, computes ₽ totals locally using `prices` + `included`; shows `(+?)` muted indicator per-row and in Net ₽ statusbar when any included resource lacks a price.

Key behaviours:
- **Toolbar**: Period buttons (Day/Week/Month/Year) | `☐ Normalize/worker` checkbox (no project-wide productivity input)
- **Productivity = staffing level**: per-building slider represents fraction of workers employed (0–100%). In `getNetFlow`, productivity is **not** applied when `applyNormalize=true` — each active worker produces at full rated rate regardless of headcount, so normalize shows intrinsic per-worker efficiency. Backend `chain-economics` always applies the productivity factor (staffing affects total throughput and chain constraint propagation regardless of normalize mode); normalize only controls `norm_factor` (÷ `workers_needed`).
- **`BlockSlider`** (`components/BlockSlider.jsx`): `min=0 max=1 step=0.01`; 10 blocks of 10% each with 1%-precision partial fill; label navy+bold if `hasOverride`, muted otherwise; `×` clear button when overriding. Fallback when no override: `1.0`.
- **Normalize/worker**: `normalizeView` bool (persisted in `localStorage` `normalize-view-${projectId}`); divides flows by `workers_needed`; column headers show `/worker/` infix (e.g. `t/worker/mo`)
- **Period selector**: Raw `.ini` values are per-worker per-game-day (materials) or MW continuous (electricity). `PERIODS` constant: `materialFactor` = game-days in period (1/7/30.44/365.24); `elecFactor` = game-days × 120 real-hours/game-day (1 game-day = 5 real days = 120 real hours). `getNetFlow` multiplies material flows by `b.workers_needed`; electricity uses `elecFactor` directly. In normalize mode the `×workers_needed` cancels the `/workers_needed` division.
- **Resource Flows table**: always `{ applyProductivity: true, applyNormalize: normalizeView }`; per-building `BlockSlider`; Qty editable `<input>` (calls `onUpdateQty`); building name is `.win95-link-btn` (calls `onBuildingClick`)
- **Chain Builder**: `Auto-detect chains` calls backend endpoint (union-find on server); confirmation dialog if chains exist; `savingChains` disables all three buttons
  - Each chain: inline rename, `☐ Prod.` checkbox only (localStorage `chain-factors-${projectId}`), ▲/▼ reorder, `Dissolve`; per-building table (`showRubles={false}`) + chain economics panel
  - Chain economics panel: Produced / Consumed / Net + "Internal %" (coverage) table with per-resource ☐ inclusion; `(+?)` per unpriced row and in statusbar Net ₽; "Idle capacity" section (building name + qty, bottleneck resource). Pass `chainPbs` + `buildingMap` from ChainCard for name lookup.
  - Chain economics computed via **backend endpoint** `POST /api/projects/<id>/chain-economics` (iterative constraint propagation, max 20 passes); `ChainCard` fetches on members/period/overrides/normalizeView change
  - Move dropdown excludes building's own chain; ungrouped groupbox shows unchained buildings
  - Deleting a building (Construction tab) auto-cleans its `ProjectChainMember` rows (backend)
- **Persistence**: per-building productivity overrides → DB; normalize view → localStorage; chain Prod. checkboxes → localStorage; chain inclusion checkboxes → localStorage

### Project Chains
- `ProjectChain`: `{ id (UUID), project_id, name, position }` — display order within a project
- `ProjectChainMember`: `{ chain_id, building_pos }` UNIQUE(chain_id, building_pos) — references `project_building.position`
- `PUT /api/projects/<id>/chains/<chain_id>/members` auto-removes `building_pos` from other chains
- `PUT /api/projects/<id>/chains` bulk-replaces all chains (used by auto-detect)
- `PUT /api/projects/<id>/chains/<chain_id>` accepts optional `position` field for reordering
- Migration: `backend/migrate_add_chains.py` — included in `make migrate`
- Chain API functions in `frontend/src/api.js`: `fetchProjectChains`, `createProjectChainAPI`, `bulkReplaceProjectChainsAPI`, `updateProjectChainAPI`, `deleteProjectChainAPI`, `updateChainMembersAPI`, `autoDetectChainsAPI`, `fetchChainEconomicsAPI`
- `autoDetectChainsAPI(projectId)` — `POST /projects/<id>/chains/auto-detect` (no body); returns `{chains: [{name, members}]}`; does NOT save
- `fetchChainEconomicsAPI(projectId, positions, period, effProductivity, productivityOverrides, normalize)` — `POST /projects/<id>/chain-economics`; `effProductivity` is always `1.0` from ChainCard; returns `{resources, produced, consumed, net, coverage, buildingUtilization, buildingLimitedBy, importRubles, exportRubles, netRubles}`

### Testing
- **Frontend unit:** Vitest + @testing-library/react + jsdom. Tests: `src/components/*.test.jsx` and `src/components/income/*.test.jsx`
- **Frontend browser:** Vitest browser mode + Playwright + Firefox. Loads `win95.css`, disables auto-cleanup (`RTL_SKIP_AUTO_CLEANUP`), 2s delay between tests for visual inspection. Setup: `src/browser-test-setup.js`
- **Backend:** pytest with in-memory SQLite. Tests: `backend/tests/`
- Test cleanup is handled by setup files (`test-setup.js` / `browser-test-setup.js`), not in test files
- For debounce testing: use real timers with `userEvent.setup({ delay: null })` + `waitFor(..., { timeout: 2000 })` — avoid `vi.useFakeTimers()` before render as it blocks `waitFor` polling
- Always-visible panels (like `.win95-search-results`) duplicate text that also appears in other parts of the page — use `getAllByText` instead of `getByText` for building names/source_files; guard `scrollIntoView` with `?.scrollIntoView` since jsdom doesn't implement it

### ESLint / react-hooks v7
Project uses `eslint-plugin-react-hooks` v7 which adds many new rules beyond classic `rules-of-hooks`/`exhaustive-deps`. Key patterns required:
- **No setState in effect bodies** (`react-hooks/set-state-in-effect`): for prop→state sync, use "set during render" (`if (prev !== current) { setPrev(current); setState(newVal) }`); for early-return setState, convert to a fully async chain with `Promise.resolve()`
- **No ref writes during render** (`react-hooks/refs`): move `ref.current = value` into a `useEffect(() => { ref.current = value }, [value])`; place the effect *after* the variable's declaration (can't forward-reference)
- **Missing deps with async effects** (`react-hooks/exhaustive-deps`): to read state inside an async effect without triggering re-runs, use a ref (`const xRef = useRef(x); useEffect(() => { xRef.current = x }, [x])`) and read `xRef.current` in the async callback; stable setters (`useState` setters) can safely be added to deps without causing extra renders

## Architecture

### Navigation
- **Info** section: Buildings list (`/`), Building detail (`/buildings/:id`)
  - BuildingList has two tabs: **Construction** (sparse resource columns + material filter) and **Resource Flows** (flow buildings only, ↑↓ annotations, direction + resource filters)
  - BuildingDetail has compact header (category/workers/days/source), Construction Costs groupbox, Operation groupbox (operation costs + production flows with ↑ Produces / ↓ Consumes rows)
- **Planning** section: Projects (`/projects`) — two tabs: **Construction** / **Production** (Resource Flows table + Chain Builder)
- **Resource Prices** panel: toggled by "Prices" button in taskbar; draggable + resizable floating panel, available on all pages
- **Loan Calculator** panel: toggled by "Loan" button in taskbar (after Prices); `DebtCalculator` component; position persisted in localStorage

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
