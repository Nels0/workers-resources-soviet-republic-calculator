import uuid

from flask import Blueprint, jsonify, request
from sqlalchemy import func, delete as sql_delete

from ..database import get_session
from ..models import (
    Project, ProjectBuilding, ProjectChain, ProjectChainMember,
    Building, Resource, CountryResourcePrice,
)

PERIODS = {
    "day":   {"material": 5,                    "elec": 24},
    "week":  {"material": 5 * 7,                "elec": 24 * 7},
    "month": {"material": 5 * 365.2425 / 12,    "elec": 24 * 365.2425 / 12},
    "year":  {"material": 5 * 365.2425,          "elec": 24 * 365.2425},
}

bp = Blueprint("projects", __name__)


@bp.route("/api/projects")
def list_projects():
    country_id = request.args.get("country_id")
    session = get_session()
    try:
        q = session.query(Project).order_by(Project.created_at)
        if country_id is not None:
            q = q.filter(Project.country_id == country_id)
        projects = q.all()
        return jsonify([p.to_dict() for p in projects])
    finally:
        session.close()


@bp.route("/api/projects", methods=["POST"])
def create_project():
    data = request.get_json()
    if not data or not data.get("name", "").strip():
        return jsonify({"error": "Name is required"}), 400

    session = get_session()
    try:
        project = Project(
            id=str(uuid.uuid4()),
            name=data["name"].strip(),
            country_id=data.get("country_id"),
        )
        session.add(project)
        session.commit()
        return jsonify(project.to_dict()), 201
    finally:
        session.close()


@bp.route("/api/projects/<project_id>")
def get_project(project_id):
    session = get_session()
    try:
        project = session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404
        return jsonify(project.to_dict())
    finally:
        session.close()


@bp.route("/api/projects/<project_id>", methods=["PUT"])
def update_project(project_id):
    data = request.get_json()
    if not data or ("name" not in data and "productivity" not in data):
        return jsonify({"error": "name or productivity is required"}), 400
    if "name" in data and not data["name"].strip():
        return jsonify({"error": "Name cannot be empty"}), 400

    session = get_session()
    try:
        project = session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404
        if "name" in data:
            project.name = data["name"].strip()
        if "productivity" in data:
            project.productivity = float(data["productivity"])
        session.commit()
        return jsonify(project.to_dict())
    finally:
        session.close()


@bp.route("/api/projects/<project_id>", methods=["DELETE"])
def delete_project(project_id):
    session = get_session()
    try:
        project = session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404
        session.delete(project)
        session.commit()
        return jsonify({"ok": True})
    finally:
        session.close()


@bp.route("/api/projects/<project_id>/buildings", methods=["POST"])
def add_building(project_id):
    data = request.get_json()
    if not data or not data.get("buildingId"):
        return jsonify({"error": "buildingId is required"}), 400

    session = get_session()
    try:
        project = session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        max_pos = max((pb.position for pb in project.buildings), default=-1)
        pb = ProjectBuilding(
            project_id=project_id,
            building_id=data["buildingId"],
            quantity=data.get("quantity", 1),
            position=max_pos + 1,
        )
        session.add(pb)
        session.commit()
        return jsonify(project.to_dict()), 201
    finally:
        session.close()


@bp.route("/api/projects/<project_id>/buildings/<int:pos>", methods=["PUT"])
def update_building(project_id, pos):
    data = request.get_json()
    if not data or ("quantity" not in data and "productivity" not in data):
        return jsonify({"error": "quantity or productivity is required"}), 400

    session = get_session()
    try:
        project = session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        pb = next((b for b in project.buildings if b.position == pos), None)
        if not pb:
            return jsonify({"error": "Building not found at position"}), 404

        if "quantity" in data:
            pb.quantity = data["quantity"]
        if "productivity" in data:
            pb.productivity = data["productivity"]  # None clears override
        session.commit()
        return jsonify(project.to_dict())
    finally:
        session.close()


@bp.route("/api/projects/<project_id>/buildings/<int:pos>", methods=["DELETE"])
def remove_building(project_id, pos):
    session = get_session()
    try:
        project = session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        pb = next((b for b in project.buildings if b.position == pos), None)
        if not pb:
            return jsonify({"error": "Building not found at position"}), 404

        # Clean up ghost chain members for this position
        chain_ids = [
            c.id
            for c in session.query(ProjectChain).filter_by(project_id=project_id).all()
        ]
        if chain_ids:
            session.execute(
                sql_delete(ProjectChainMember)
                .where(ProjectChainMember.chain_id.in_(chain_ids))
                .where(ProjectChainMember.building_pos == pos)
            )
            session.flush()

        session.delete(pb)
        session.commit()
        return jsonify(project.to_dict())
    finally:
        session.close()


@bp.route("/api/projects/import", methods=["POST"])
def import_projects():
    data = request.get_json()
    if not data or "projects" not in data:
        return jsonify({"error": "Missing 'projects' in request body"}), 400

    session = get_session()
    try:
        imported = []
        for proj_data in data["projects"]:
            project = Project(
                id=proj_data.get("id", str(uuid.uuid4())),
                name=proj_data.get("name", "Untitled"),
                country_id=proj_data.get("country_id"),
            )
            session.add(project)
            for i, b in enumerate(proj_data.get("buildings", [])):
                pb = ProjectBuilding(
                    project_id=project.id,
                    building_id=b["buildingId"],
                    quantity=b.get("quantity", 1),
                    position=i,
                )
                session.add(pb)
            imported.append(project)

        session.commit()
        return jsonify([p.to_dict() for p in imported]), 201
    finally:
        session.close()


# --- Chain routes ---

@bp.route("/api/projects/<project_id>/chains")
def list_chains(project_id):
    session = get_session()
    try:
        project = session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404
        chains = (
            session.query(ProjectChain)
            .filter_by(project_id=project_id)
            .order_by(ProjectChain.position)
            .all()
        )
        return jsonify([c.to_dict() for c in chains])
    finally:
        session.close()


@bp.route("/api/projects/<project_id>/chains", methods=["POST"])
def create_chain(project_id):
    data = request.get_json()
    if not data or not data.get("name", "").strip():
        return jsonify({"error": "Name is required"}), 400

    session = get_session()
    try:
        project = session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        max_pos = (
            session.query(func.max(ProjectChain.position))
            .filter_by(project_id=project_id)
            .scalar()
        )
        max_pos = max_pos if max_pos is not None else -1
        chain = ProjectChain(
            project_id=project_id,
            name=data["name"].strip(),
            position=max_pos + 1,
        )
        session.add(chain)
        session.commit()
        return jsonify(chain.to_dict()), 201
    finally:
        session.close()


@bp.route("/api/projects/<project_id>/chains", methods=["PUT"])
def bulk_replace_chains(project_id):
    """Bulk-replace all chains for a project (used by auto-detect)."""
    data = request.get_json()
    if not data or "chains" not in data:
        return jsonify({"error": "chains is required"}), 400

    session = get_session()
    try:
        project = session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        session.execute(sql_delete(ProjectChain).where(ProjectChain.project_id == project_id))
        session.flush()

        new_chains = []
        for i, c in enumerate(data["chains"]):
            name = (c.get("name") or f"Chain {i + 1}").strip() or f"Chain {i + 1}"
            chain = ProjectChain(project_id=project_id, name=name, position=i)
            session.add(chain)
            session.flush()
            for pos in c.get("members", []):
                session.add(ProjectChainMember(chain_id=chain.id, building_pos=int(pos)))
            new_chains.append(chain)

        session.commit()
        return jsonify([c.to_dict() for c in new_chains])
    finally:
        session.close()


@bp.route("/api/projects/<project_id>/chains/<chain_id>", methods=["PUT"])
def update_chain(project_id, chain_id):
    data = request.get_json()
    if not data or not data.get("name", "").strip():
        return jsonify({"error": "Name is required"}), 400

    session = get_session()
    try:
        chain = session.get(ProjectChain, chain_id)
        if not chain or chain.project_id != project_id:
            return jsonify({"error": "Chain not found"}), 404
        chain.name = data["name"].strip()
        if "position" in data and data["position"] is not None:
            chain.position = int(data["position"])
        session.commit()
        return jsonify(chain.to_dict())
    finally:
        session.close()


@bp.route("/api/projects/<project_id>/chains/<chain_id>", methods=["DELETE"])
def delete_chain(project_id, chain_id):
    session = get_session()
    try:
        chain = session.get(ProjectChain, chain_id)
        if not chain or chain.project_id != project_id:
            return jsonify({"error": "Chain not found"}), 404
        session.delete(chain)
        session.commit()
        return jsonify({"ok": True})
    finally:
        session.close()


@bp.route("/api/projects/<project_id>/chains/<chain_id>/members", methods=["PUT"])
def update_chain_members(project_id, chain_id):
    """Bulk-replace the member list for a chain.
    Automatically removes these positions from any other chain in the project."""
    data = request.get_json()
    if not data or "positions" not in data:
        return jsonify({"error": "positions is required"}), 400

    session = get_session()
    try:
        chain = session.get(ProjectChain, chain_id)
        if not chain or chain.project_id != project_id:
            return jsonify({"error": "Chain not found"}), 404

        positions = [int(p) for p in data["positions"]]

        # Remove these positions from other chains in the project
        other_chains = (
            session.query(ProjectChain)
            .filter(ProjectChain.project_id == project_id, ProjectChain.id != chain_id)
            .all()
        )
        for other in other_chains:
            for member in list(other.members):
                if member.building_pos in positions:
                    session.delete(member)
        session.flush()

        # Replace this chain's members
        for member in list(chain.members):
            session.delete(member)
        session.flush()

        for pos in positions:
            session.add(ProjectChainMember(chain_id=chain_id, building_pos=pos))

        session.commit()
        return jsonify(chain.to_dict())
    finally:
        session.close()


# --- Chain analysis routes ---

@bp.route("/api/projects/<project_id>/chains/auto-detect", methods=["POST"])
def auto_detect_chains(project_id):
    """Suggest chain groupings based on shared resource flows. Does NOT save."""
    session = get_session()
    try:
        project = session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        if not project.buildings:
            return jsonify({"chains": []})

        building_ids = [pb.building_id for pb in project.buildings]
        buildings = session.query(Building).filter(Building.id.in_(building_ids)).all()
        building_map = {b.id: b for b in buildings}

        # Filter to project buildings with flow data
        flow_pbs = [
            pb for pb in project.buildings
            if building_map.get(pb.building_id) and building_map[pb.building_id].flows
        ]
        if not flow_pbs:
            return jsonify({"chains": []})

        # Union-find over positions
        parent = {pb.position: pb.position for pb in flow_pbs}

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(x, y):
            parent[find(x)] = find(y)

        resource_to_positions = {}
        for pb in flow_pbs:
            b = building_map[pb.building_id]
            for f in b.flows:
                if f.resource_id not in resource_to_positions:
                    resource_to_positions[f.resource_id] = []
                resource_to_positions[f.resource_id].append(pb.position)

        for positions in resource_to_positions.values():
            for i in range(1, len(positions)):
                union(positions[0], positions[i])

        components = {}
        for pb in flow_pbs:
            root = find(pb.position)
            if root not in components:
                components[root] = []
            components[root].append(pb.position)

        all_resource_ids = {f.resource_id for b in buildings for f in b.flows}
        resources = session.query(Resource).filter(Resource.id.in_(all_resource_ids)).all()
        resource_map = {r.id: r for r in resources}

        pb_by_pos = {pb.position: pb for pb in project.buildings}
        new_chains = []
        for i, (_, members) in enumerate(components.items()):
            produced = {}
            for pos in members:
                pb = pb_by_pos.get(pos)
                if not pb:
                    continue
                b = building_map.get(pb.building_id)
                if not b:
                    continue
                for f in b.flows:
                    if f.direction == "produces":
                        produced[f.resource_id] = produced.get(f.resource_id, 0) + f.quantity * pb.quantity

            best_name = None
            best_qty = 0
            for rid, qty in produced.items():
                if qty > best_qty:
                    best_qty = qty
                    best_name = resource_map[rid].name if rid in resource_map else None

            new_chains.append({
                "name": best_name or f"Chain {i + 1}",
                "members": sorted(members),
            })

        return jsonify({"chains": new_chains})
    finally:
        session.close()


@bp.route("/api/projects/<project_id>/chain-economics", methods=["POST"])
def chain_economics(project_id):
    """Compute chain economics (constraint propagation + ruble totals) for a set of positions."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    period = data.get("period", "month")
    if period not in PERIODS:
        return jsonify({"error": "Invalid period"}), 400

    positions = list({int(p) for p in data.get("positions", [])})
    project_productivity = float(data.get("project_productivity", 1.0))
    productivity_overrides = {str(k): float(v) for k, v in data.get("productivity_overrides", {}).items()}
    normalize = bool(data.get("normalize", False))

    session = get_session()
    try:
        project = session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        empty_response = {
            "resources": [], "produced": {}, "consumed": {}, "net": {},
            "coverage": {}, "buildingUtilization": {}, "buildingLimitedBy": {},
            "importRubles": 0.0, "exportRubles": 0.0, "netRubles": 0.0,
        }

        pos_set = set(positions)
        pbs = [pb for pb in project.buildings if pb.position in pos_set]
        if not pbs:
            return jsonify(empty_response)

        building_ids = [pb.building_id for pb in pbs]
        buildings = session.query(Building).filter(Building.id.in_(building_ids)).all()
        building_map = {b.id: b for b in buildings}

        all_resource_ids = {f.resource_id for b in buildings for f in b.flows}
        if not all_resource_ids:
            return jsonify(empty_response)

        resources = session.query(Resource).filter(Resource.id.in_(all_resource_ids)).all()

        prices = {}
        if project.country_id:
            for row in (
                session.query(CountryResourcePrice)
                .filter_by(country_id=project.country_id)
                .all()
            ):
                prices[row.resource_id] = {
                    "import": row.import_price or 0.0,
                    "export": row.export_price or 0.0,
                }

        period_data = PERIODS[period]

        building_produces = {b.id: {} for b in buildings}
        building_consumes = {b.id: {} for b in buildings}
        for b in buildings:
            for f in b.flows:
                if f.direction == "produces":
                    building_produces[b.id][f.resource_id] = f.quantity
                else:
                    building_consumes[b.id][f.resource_id] = f.quantity

        def period_mult(r):
            return period_data["elec"] if r.unit == "MW" else period_data["material"]

        active_pbs = [pb for pb in pbs if building_map.get(pb.building_id)]

        pb_base_produced = {}
        pb_base_consumed = {}
        for pb in active_pbs:
            b = building_map[pb.building_id]
            factor = productivity_overrides.get(str(pb.position), project_productivity)
            norm_factor = float(b.workers_needed) if normalize and b.workers_needed > 0 else 1.0
            pb_base_produced[pb.position] = {}
            pb_base_consumed[pb.position] = {}
            for r in resources:
                mult = period_mult(r)
                pb_base_produced[pb.position][r.id] = (
                    building_produces[b.id].get(r.id, 0) * pb.quantity * mult * factor / norm_factor
                )
                pb_base_consumed[pb.position][r.id] = (
                    building_consumes[b.id].get(r.id, 0) * pb.quantity * mult * factor / norm_factor
                )

        cfactor = {pb.position: 1.0 for pb in active_pbs}
        building_limited_by = {}
        for _ in range(20):
            eff_produced = {r.id: 0.0 for r in resources}
            eff_consumed = {r.id: 0.0 for r in resources}
            for pb in active_pbs:
                cf = cfactor[pb.position]
                for r in resources:
                    eff_produced[r.id] += pb_base_produced[pb.position][r.id] * cf
                    eff_consumed[r.id] += pb_base_consumed[pb.position][r.id] * cf

            coverage = {}
            for r in resources:
                if eff_produced[r.id] > 0 and eff_consumed[r.id] > 0:
                    coverage[r.id] = eff_produced[r.id] / eff_consumed[r.id]

            any_changed = False
            for pb in active_pbs:
                min_cov = 1.0
                limit_rid = None
                for r in resources:
                    c = pb_base_consumed[pb.position][r.id]
                    if c > 0 and r.id in coverage and coverage[r.id] < min_cov - 1e-9:
                        min_cov = coverage[r.id]
                        limit_rid = r.id
                if min_cov < 1.0 - 1e-9:
                    new_cf = cfactor[pb.position] * min_cov
                    if abs(new_cf - cfactor[pb.position]) > 1e-9:
                        cfactor[pb.position] = new_cf
                        building_limited_by[pb.position] = limit_rid
                        any_changed = True
            if not any_changed:
                break

        produced = {r.id: 0.0 for r in resources}
        consumed = {r.id: 0.0 for r in resources}
        for pb in active_pbs:
            cf = cfactor[pb.position]
            for r in resources:
                produced[r.id] += pb_base_produced[pb.position][r.id] * cf
                consumed[r.id] += pb_base_consumed[pb.position][r.id] * cf

        net = {r.id: produced[r.id] - consumed[r.id] for r in resources}

        final_coverage = {}
        for r in resources:
            if produced[r.id] > 0 and consumed[r.id] > 0:
                final_coverage[r.id] = produced[r.id] / consumed[r.id]

        building_utilization = {}
        for pb in active_pbs:
            if cfactor[pb.position] < 1.0 - 1e-6:
                building_utilization[pb.position] = cfactor[pb.position]

        import_rubles = 0.0
        export_rubles = 0.0
        for r in resources:
            n = net[r.id]
            if n == 0:
                continue
            r_prices = prices.get(r.id, {})
            if n < 0:
                import_rubles += abs(n) * r_prices.get("import", 0.0)
            else:
                export_rubles += n * r_prices.get("export", 0.0)

        active_rids = {r.id for r in resources if produced[r.id] != 0 or consumed[r.id] != 0}

        return jsonify({
            "resources": [r.to_dict() for r in resources if r.id in active_rids],
            "produced": {str(r.id): produced[r.id] for r in resources if r.id in active_rids},
            "consumed": {str(r.id): consumed[r.id] for r in resources if r.id in active_rids},
            "net": {str(r.id): net[r.id] for r in resources if r.id in active_rids},
            "coverage": {str(k): v for k, v in final_coverage.items()},
            "buildingUtilization": {str(k): v for k, v in building_utilization.items()},
            "buildingLimitedBy": {str(k): v for k, v in building_limited_by.items()},
            "importRubles": import_rubles,
            "exportRubles": export_rubles,
            "netRubles": export_rubles - import_rubles,
        })
    finally:
        session.close()
