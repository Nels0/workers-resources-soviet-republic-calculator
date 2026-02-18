import uuid

from flask import Blueprint, jsonify, request

from ..database import get_session
from ..models import Project, ProjectBuilding

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
    if not data or not data.get("name", "").strip():
        return jsonify({"error": "Name is required"}), 400

    session = get_session()
    try:
        project = session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404
        project.name = data["name"].strip()
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
    if not data or "quantity" not in data:
        return jsonify({"error": "quantity is required"}), 400

    session = get_session()
    try:
        project = session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        pb = next((b for b in project.buildings if b.position == pos), None)
        if not pb:
            return jsonify({"error": "Building not found at position"}), 404

        pb.quantity = data["quantity"]
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
