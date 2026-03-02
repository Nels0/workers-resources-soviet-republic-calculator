import uuid

from flask import Blueprint, jsonify, request
from sqlalchemy import delete as sql_delete

from ..database import get_session
from ..models import Country, CountryResourcePrice

bp = Blueprint("countries", __name__)


@bp.route("/api/countries")
def list_countries():
    session = get_session()
    try:
        countries = session.query(Country).order_by(Country.created_at).all()
        return jsonify([c.to_dict() for c in countries])
    finally:
        session.close()


@bp.route("/api/countries", methods=["POST"])
def create_country():
    data = request.get_json()
    if not data or not data.get("name", "").strip():
        return jsonify({"error": "Name is required"}), 400

    session = get_session()
    try:
        country = Country(id=str(uuid.uuid4()), name=data["name"].strip())
        session.add(country)
        session.commit()
        return jsonify(country.to_dict()), 201
    finally:
        session.close()


@bp.route("/api/countries/<country_id>", methods=["PUT"])
def rename_country(country_id):
    data = request.get_json()
    if not data or not data.get("name", "").strip():
        return jsonify({"error": "Name is required"}), 400

    session = get_session()
    try:
        country = session.get(Country, country_id)
        if not country:
            return jsonify({"error": "Country not found"}), 404
        country.name = data["name"].strip()
        session.commit()
        return jsonify(country.to_dict())
    finally:
        session.close()


@bp.route("/api/countries/<country_id>", methods=["DELETE"])
def delete_country(country_id):
    session = get_session()
    try:
        country = session.get(Country, country_id)
        if not country:
            return jsonify({"error": "Country not found"}), 404
        if country.projects:
            return jsonify({"error": "Country has projects; delete or move them first"}), 409
        session.delete(country)
        session.commit()
        return jsonify({"ok": True})
    finally:
        session.close()


def _prices_dict(prices):
    return {
        str(p.resource_id): {"import": p.import_price, "export": p.export_price}
        for p in prices
    }


@bp.route("/api/countries/<country_id>/prices")
def get_country_prices(country_id):
    session = get_session()
    try:
        country = session.get(Country, country_id)
        if not country:
            return jsonify({"error": "Country not found"}), 404
        return jsonify(_prices_dict(country.prices))
    finally:
        session.close()


@bp.route("/api/countries/<country_id>/prices", methods=["PUT"])
def update_country_prices(country_id):
    data = request.get_json()
    if not data or "prices" not in data:
        return jsonify({"error": "Missing 'prices' in request body"}), 400

    session = get_session()
    try:
        country = session.get(Country, country_id)
        if not country:
            return jsonify({"error": "Country not found"}), 404

        session.execute(sql_delete(CountryResourcePrice).where(
            CountryResourcePrice.country_id == country_id
        ))
        session.flush()

        for resource_id, entry in data["prices"].items():
            if not entry:
                continue
            import_p = float(entry.get("import") or 0)
            export_p = float(entry.get("export") or 0)
            if import_p > 0 or export_p > 0:
                session.add(CountryResourcePrice(
                    country_id=country_id,
                    resource_id=int(resource_id),
                    import_price=import_p,
                    export_price=export_p,
                ))

        session.commit()
        session.refresh(country)
        return jsonify(_prices_dict(country.prices))
    finally:
        session.close()
