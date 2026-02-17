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

## Projects

GET /api/projects
  List all projects, ordered by creation date.
  Returns: [{ id, name, buildings }]

POST /api/projects
  Create a new project.
  Body: { name }
  Returns: { id, name, buildings: [] }

GET /api/projects/<id>
  Single project.
  Returns: { id, name, buildings: [{ buildingId, quantity, position }] }

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
  Body: { projects: [{ id?, name, buildings: [{ buildingId, quantity }] }] }
  Returns: [imported projects]

## Health

GET /api/health
  Returns: { status: "ok" }
