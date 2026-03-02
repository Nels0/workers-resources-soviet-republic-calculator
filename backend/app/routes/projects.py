import uuid

from flask import Blueprint, jsonify, request
from sqlalchemy import func, delete as sql_delete

from ..database import get_session
from ..models import Project, ProjectBuilding, ProjectChain, ProjectChainMember

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
