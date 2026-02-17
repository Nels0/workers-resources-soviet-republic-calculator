from flask import Blueprint, jsonify, request

from ..database import get_session
from ..models import Building, BuildingCost, Resource

bp = Blueprint("buildings", __name__)


@bp.route("/api/buildings")
def list_buildings():
    session = get_session()
    try:
        query = session.query(Building)
        search = request.args.get("search", "").strip()
        if search:
            query = query.filter(
                Building.name.ilike(f"%{search}%")
                | Building.source_file.ilike(f"%{search}%")
            )
        category = request.args.get("category", "").strip()
        if category:
            query = query.filter(Building.category == category)
        buildings = query.order_by(Building.name).all()

        resources = session.query(Resource).order_by(Resource.name).all()
        resource_list = [r.to_dict() for r in resources]

        rows = []
        for b in buildings:
            row = b.to_dict()
            construction_map = {}
            operation_map = {}
            for c in b.costs:
                if c.phase == "construction":
                    construction_map[c.resource_id] = c.quantity
                elif c.phase == "operation":
                    operation_map[c.resource_id] = c.quantity
            row["resource_costs"] = {r.id: construction_map.get(r.id, 0) for r in resources}
            row["operation_costs"] = {r.id: operation_map.get(r.id, 0) for r in resources}
            rows.append(row)

        return jsonify({"resources": resource_list, "buildings": rows})
    finally:
        session.close()


@bp.route("/api/buildings/<int:building_id>")
def get_building(building_id):
    session = get_session()
    try:
        building = session.get(Building, building_id)
        if not building:
            return jsonify({"error": "Building not found"}), 404
        return jsonify(building.to_dict(include_costs=True))
    finally:
        session.close()


@bp.route("/api/resources")
def list_resources():
    session = get_session()
    try:
        resources = session.query(Resource).order_by(Resource.name).all()
        return jsonify([r.to_dict() for r in resources])
    finally:
        session.close()


@bp.route("/api/calculate", methods=["POST"])
def calculate():
    """Calculate total costs for a list of buildings with quantities.

    Expects JSON: {"items": [{"building_id": 1, "quantity": 2}, ...]}
    Returns aggregated resource totals per phase.
    """
    data = request.get_json()
    if not data or "items" not in data:
        return jsonify({"error": "Missing 'items' in request body"}), 400

    session = get_session()
    try:
        totals = {}  # keyed by (resource_id, phase)
        for item in data["items"]:
            building_id = item.get("building_id")
            quantity = item.get("quantity", 1)
            if not building_id or quantity < 1:
                continue

            costs = session.query(BuildingCost).filter_by(building_id=building_id).all()
            for cost in costs:
                key = (cost.resource_id, cost.phase)
                if key not in totals:
                    resource = session.get(Resource, cost.resource_id)
                    totals[key] = {
                        "resource": resource.to_dict() if resource else None,
                        "phase": cost.phase,
                        "total": 0.0,
                    }
                totals[key]["total"] += cost.quantity * quantity

        result = sorted(totals.values(), key=lambda t: (t["phase"], t["resource"]["name"] if t["resource"] else ""))
        return jsonify({"totals": result})
    finally:
        session.close()
