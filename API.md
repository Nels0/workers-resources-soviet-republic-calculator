# API Routes

Base URL: `/api`

## Buildings

GET /api/buildings?search=&category=
  List buildings with resource costs.
  Returns: { resources: [...], buildings: [...] }
  Each building includes flat resource_costs and operation_costs dicts keyed by resource ID.

GET /api/buildings/<id>
  Single building with nested costs array.
  Returns: { id, name, category, ..., costs: [{ resource, quantity, phase }] }

## Resources

GET /api/resources
  All resource types.
  Returns: [{ id, name, type, unit }]

## Calculate

POST /api/calculate
  Aggregate costs for a list of buildings with quantities.
  Body: { items: [{ building_id, quantity }] }
  Returns: { totals: [{ resource, phase, total }] }

## Countries

GET /api/countries
  List all countries, ordered by creation date.
  Returns: [{ id, name, created_at }]

POST /api/countries
  Create a new country.
  Body: { name }
  Returns: { id, name, created_at }

PUT /api/countries/<id>
  Rename a country.
  Body: { name }
  Returns: updated country

DELETE /api/countries/<id>
  Delete a country (only if it has no projects).
  Returns: { ok: true } or 409 if country has projects.

GET /api/countries/<id>/prices
  Get resource prices for a country.
  Returns: { "<resourceId>": { "import": price, "export": price }, ... }

PUT /api/countries/<id>/prices
  Bulk replace resource prices for a country. Entries where both import and export are 0/null are discarded.
  Body: { prices: { "<resourceId>": { "import": price, "export": price } } }
  Returns: { "<resourceId>": { "import": price, "export": price }, ... }

## Projects

GET /api/projects?country_id=<id>
  List projects, optionally filtered by country_id, ordered by creation date.
  Returns: [{ id, name, country_id, buildings }]

POST /api/projects
  Create a new project.
  Body: { name, country_id? }
  Returns: { id, name, country_id, buildings: [] }

GET /api/projects/<id>
  Single project.
  Returns: { id, name, country_id, buildings: [{ buildingId, quantity, position }] }

PUT /api/projects/<id>
  Rename a project.
  Body: { name }
  Returns: updated project

DELETE /api/projects/<id>
  Delete a project and all its buildings.
  Returns: { ok: true }

POST /api/projects/<id>/buildings
  Add a building to a project.
  Body: { buildingId, quantity? }
  Returns: updated project

PUT /api/projects/<id>/buildings/<position>
  Update building quantity at a position.
  Body: { quantity }
  Returns: updated project

DELETE /api/projects/<id>/buildings/<position>
  Remove a building at a position.
  Returns: updated project

POST /api/projects/import
  Bulk import projects (used for localStorage migration).
  Body: { projects: [{ id?, name, country_id?, buildings: [{ buildingId, quantity }] }] }
  Returns: [imported projects]

## Project Chains

GET /api/projects/<id>/chains
  List chains for a project, ordered by position.
  Returns: [{ id, name, position, members: [building_pos, ...] }]

POST /api/projects/<id>/chains
  Create a new chain.
  Body: { name }
  Returns: { id, name, position, members: [] }

PUT /api/projects/<id>/chains
  Bulk-replace all chains for a project (used by auto-detect).
  Body: { chains: [{ name, members: [building_pos] }] }
  Returns: [{ id, name, position, members }]

PUT /api/projects/<id>/chains/<chain_id>
  Rename a chain.
  Body: { name }
  Returns: updated chain

DELETE /api/projects/<id>/chains/<chain_id>
  Delete a chain (members become ungrouped).
  Returns: { ok: true }

PUT /api/projects/<id>/chains/<chain_id>/members
  Bulk-replace the member list for a chain.
  Automatically removes these positions from any other chain in the project.
  Body: { positions: [int] }
  Returns: updated chain

POST /api/projects/<id>/chains/auto-detect
  Suggest chain groupings based on shared resource flows. Does NOT save.
  No body required.
  Returns: { chains: [{ name, members: [building_pos] }] }

POST /api/projects/<id>/chain-economics
  Compute chain economics (constraint propagation + ruble totals) for a set of building positions.
  Body: { period, positions: [int], project_productivity: float, productivity_overrides: {pos: float}, normalize?: bool }
  Returns: { resources, produced, consumed, net, coverage, buildingUtilization, buildingLimitedBy, importRubles, exportRubles, netRubles }

## Health

GET /api/health
  Returns: { status: "ok" }
