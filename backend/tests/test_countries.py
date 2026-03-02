import pytest

from app import create_app
from app.database import get_session
from app.models import Country, CountryResourcePrice, Project, Resource


@pytest.fixture
def client():
    """Create a fresh test client with an empty in-memory database for each test."""
    import app.config as config
    import app.database as db

    original_uri = config.SQLALCHEMY_DATABASE_URI
    config.SQLALCHEMY_DATABASE_URI = "sqlite://"

    db.engine = db.create_engine(config.SQLALCHEMY_DATABASE_URI)
    db.SessionLocal = db.sessionmaker(bind=db.engine)

    app = create_app()
    app.config["TESTING"] = True

    with app.test_client() as client:
        yield client

    config.SQLALCHEMY_DATABASE_URI = original_uri
    db.engine = db.create_engine(original_uri)
    db.SessionLocal = db.sessionmaker(bind=db.engine)


@pytest.fixture
def client_with_resources(client):
    """Client with resources seeded for price tests."""
    session = get_session()
    try:
        session.add_all([
            Resource(id=1, name="Concrete", type="material", unit="t"),
            Resource(id=2, name="Steel", type="material", unit="t"),
            Resource(id=3, name="Workers", type="workforce", unit="workers"),
        ])
        session.commit()
    finally:
        session.close()
    return client


class TestCreateCountry:
    def test_create_country_returns_201(self, client):
        resp = client.post("/api/countries", json={"name": "My Country"})
        assert resp.status_code == 201

    def test_create_country_returns_data(self, client):
        resp = client.post("/api/countries", json={"name": "My Country"})
        data = resp.get_json()
        assert data["name"] == "My Country"
        assert "id" in data
        assert "created_at" in data

    def test_create_country_generates_uuid(self, client):
        resp = client.post("/api/countries", json={"name": "Test"})
        data = resp.get_json()
        parts = data["id"].split("-")
        assert len(parts) == 5

    def test_create_country_trims_whitespace(self, client):
        resp = client.post("/api/countries", json={"name": "  My Country  "})
        assert resp.get_json()["name"] == "My Country"

    def test_create_country_empty_name_returns_400(self, client):
        resp = client.post("/api/countries", json={"name": ""})
        assert resp.status_code == 400

    def test_create_country_whitespace_only_returns_400(self, client):
        resp = client.post("/api/countries", json={"name": "   "})
        assert resp.status_code == 400

    def test_create_country_missing_name_returns_400(self, client):
        resp = client.post("/api/countries", json={})
        assert resp.status_code == 400

    def test_create_country_persists(self, client):
        client.post("/api/countries", json={"name": "Persisted"})
        resp = client.get("/api/countries")
        countries = resp.get_json()
        assert len(countries) == 1
        assert countries[0]["name"] == "Persisted"


class TestListCountries:
    def test_list_countries_empty(self, client):
        resp = client.get("/api/countries")
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_list_countries_ordered_by_created_at(self, client):
        client.post("/api/countries", json={"name": "First"})
        client.post("/api/countries", json={"name": "Second"})
        client.post("/api/countries", json={"name": "Third"})

        resp = client.get("/api/countries")
        names = [c["name"] for c in resp.get_json()]
        assert names == ["First", "Second", "Third"]

    def test_list_countries_returns_id_and_name(self, client):
        client.post("/api/countries", json={"name": "Alpha"})
        resp = client.get("/api/countries")
        country = resp.get_json()[0]
        assert "id" in country
        assert "name" in country


class TestDeleteCountry:
    def test_delete_empty_country_returns_200(self, client):
        resp = client.post("/api/countries", json={"name": "Empty"})
        cid = resp.get_json()["id"]

        resp = client.delete(f"/api/countries/{cid}")
        assert resp.status_code == 200
        assert resp.get_json() == {"ok": True}

    def test_delete_removes_country(self, client):
        resp = client.post("/api/countries", json={"name": "Temp"})
        cid = resp.get_json()["id"]

        client.delete(f"/api/countries/{cid}")

        resp = client.get("/api/countries")
        assert resp.get_json() == []

    def test_delete_country_with_projects_returns_409(self, client):
        resp = client.post("/api/countries", json={"name": "Has Projects"})
        cid = resp.get_json()["id"]

        client.post("/api/projects", json={"name": "My Project", "country_id": cid})

        resp = client.delete(f"/api/countries/{cid}")
        assert resp.status_code == 409

    def test_delete_country_cascades_prices(self, client_with_resources):
        resp = client_with_resources.post("/api/countries", json={"name": "Test"})
        cid = resp.get_json()["id"]

        client_with_resources.put(f"/api/countries/{cid}/prices", json={
            "prices": {"1": {"import": 10.0, "export": 0}}
        })

        client_with_resources.delete(f"/api/countries/{cid}")

        # Country is gone; verify no orphan prices in DB
        session = get_session()
        try:
            prices = session.query(CountryResourcePrice).filter_by(country_id=cid).all()
            assert prices == []
        finally:
            session.close()

    def test_delete_nonexistent_country_returns_404(self, client):
        resp = client.delete("/api/countries/nonexistent")
        assert resp.status_code == 404


class TestRenameCountry:
    def test_rename_country_returns_200(self, client):
        resp = client.post("/api/countries", json={"name": "Old Name"})
        cid = resp.get_json()["id"]

        resp = client.put(f"/api/countries/{cid}", json={"name": "New Name"})
        assert resp.status_code == 200
        assert resp.get_json()["name"] == "New Name"

    def test_rename_country_trims_whitespace(self, client):
        resp = client.post("/api/countries", json={"name": "Old"})
        cid = resp.get_json()["id"]

        resp = client.put(f"/api/countries/{cid}", json={"name": "  New  "})
        assert resp.get_json()["name"] == "New"

    def test_rename_country_empty_name_returns_400(self, client):
        resp = client.post("/api/countries", json={"name": "Old"})
        cid = resp.get_json()["id"]

        resp = client.put(f"/api/countries/{cid}", json={"name": ""})
        assert resp.status_code == 400

    def test_rename_nonexistent_country_returns_404(self, client):
        resp = client.put("/api/countries/nonexistent", json={"name": "New"})
        assert resp.status_code == 404


class TestCountryPrices:
    def test_get_prices_empty(self, client_with_resources):
        resp = client_with_resources.post("/api/countries", json={"name": "Test"})
        cid = resp.get_json()["id"]

        resp = client_with_resources.get(f"/api/countries/{cid}/prices")
        assert resp.status_code == 200
        assert resp.get_json() == {}

    def test_put_prices_persists(self, client_with_resources):
        resp = client_with_resources.post("/api/countries", json={"name": "Test"})
        cid = resp.get_json()["id"]

        resp = client_with_resources.put(f"/api/countries/{cid}/prices", json={
            "prices": {
                "1": {"import": 10.5, "export": 0},
                "2": {"import": 0, "export": 20.0},
            }
        })
        assert resp.status_code == 200
        assert resp.get_json() == {
            "1": {"import": 10.5, "export": 0.0},
            "2": {"import": 0.0, "export": 20.0},
        }

    def test_get_prices_after_put(self, client_with_resources):
        resp = client_with_resources.post("/api/countries", json={"name": "Test"})
        cid = resp.get_json()["id"]

        client_with_resources.put(f"/api/countries/{cid}/prices", json={
            "prices": {"1": {"import": 10.5, "export": 0}}
        })

        resp = client_with_resources.get(f"/api/countries/{cid}/prices")
        assert resp.status_code == 200
        assert resp.get_json() == {"1": {"import": 10.5, "export": 0.0}}

    def test_put_prices_same_resource_twice_no_error(self, client_with_resources):
        """Regression: second PUT for same resource must not raise UNIQUE constraint."""
        resp = client_with_resources.post("/api/countries", json={"name": "Test"})
        cid = resp.get_json()["id"]

        client_with_resources.put(f"/api/countries/{cid}/prices", json={
            "prices": {"1": {"import": 10.0, "export": 0}}
        })
        resp = client_with_resources.put(f"/api/countries/{cid}/prices", json={
            "prices": {"1": {"import": 312.0, "export": 0}}
        })
        assert resp.status_code == 200
        assert resp.get_json() == {"1": {"import": 312.0, "export": 0.0}}

    def test_put_prices_replaces_all(self, client_with_resources):
        resp = client_with_resources.post("/api/countries", json={"name": "Test"})
        cid = resp.get_json()["id"]

        client_with_resources.put(f"/api/countries/{cid}/prices", json={
            "prices": {
                "1": {"import": 10.0, "export": 0},
                "2": {"import": 20.0, "export": 0},
            }
        })
        resp = client_with_resources.put(f"/api/countries/{cid}/prices", json={
            "prices": {"3": {"import": 5.0, "export": 0}}
        })
        assert resp.get_json() == {"3": {"import": 5.0, "export": 0.0}}

    def test_zero_prices_not_stored(self, client_with_resources):
        resp = client_with_resources.post("/api/countries", json={"name": "Test"})
        cid = resp.get_json()["id"]

        resp = client_with_resources.put(f"/api/countries/{cid}/prices", json={
            "prices": {
                "1": {"import": 10.0, "export": 0},
                "2": {"import": 0, "export": 0},
            }
        })
        assert resp.get_json() == {"1": {"import": 10.0, "export": 0.0}}

    def test_null_prices_not_stored(self, client_with_resources):
        resp = client_with_resources.post("/api/countries", json={"name": "Test"})
        cid = resp.get_json()["id"]

        resp = client_with_resources.put(f"/api/countries/{cid}/prices", json={
            "prices": {"1": {"import": 10.0, "export": 0}, "2": None}
        })
        assert resp.get_json() == {"1": {"import": 10.0, "export": 0.0}}

    def test_prices_404_for_nonexistent_country(self, client_with_resources):
        resp = client_with_resources.get("/api/countries/nonexistent/prices")
        assert resp.status_code == 404

        resp = client_with_resources.put("/api/countries/nonexistent/prices", json={
            "prices": {"1": 10.0}
        })
        assert resp.status_code == 404

    def test_put_prices_400_for_missing_body(self, client_with_resources):
        resp = client_with_resources.post("/api/countries", json={"name": "Test"})
        cid = resp.get_json()["id"]

        resp = client_with_resources.put(
            f"/api/countries/{cid}/prices",
            content_type="application/json"
        )
        assert resp.status_code == 400


class TestProjectCountryScope:
    def test_create_project_with_country_id(self, client):
        resp = client.post("/api/countries", json={"name": "Test Country"})
        cid = resp.get_json()["id"]

        resp = client.post("/api/projects", json={"name": "My Project", "country_id": cid})
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["country_id"] == cid

    def test_create_project_without_country_id(self, client):
        resp = client.post("/api/projects", json={"name": "No Country"})
        assert resp.status_code == 201
        data = resp.get_json()
        assert data.get("country_id") is None

    def test_filter_projects_by_country_id(self, client):
        resp = client.post("/api/countries", json={"name": "Country A"})
        cid_a = resp.get_json()["id"]

        resp = client.post("/api/countries", json={"name": "Country B"})
        cid_b = resp.get_json()["id"]

        client.post("/api/projects", json={"name": "Project A1", "country_id": cid_a})
        client.post("/api/projects", json={"name": "Project A2", "country_id": cid_a})
        client.post("/api/projects", json={"name": "Project B1", "country_id": cid_b})
        client.post("/api/projects", json={"name": "No Country"})

        resp = client.get(f"/api/projects?country_id={cid_a}")
        projects = resp.get_json()
        assert len(projects) == 2
        names = [p["name"] for p in projects]
        assert "Project A1" in names
        assert "Project A2" in names

    def test_list_all_projects_without_filter(self, client):
        resp = client.post("/api/countries", json={"name": "Country"})
        cid = resp.get_json()["id"]

        client.post("/api/projects", json={"name": "P1", "country_id": cid})
        client.post("/api/projects", json={"name": "P2"})

        resp = client.get("/api/projects")
        assert len(resp.get_json()) == 2

    def test_project_dict_has_country_id_key(self, client):
        resp = client.post("/api/countries", json={"name": "Test"})
        cid = resp.get_json()["id"]

        resp = client.post("/api/projects", json={"name": "P", "country_id": cid})
        data = resp.get_json()
        assert "country_id" in data

    def test_project_dict_has_no_prices_key(self, client):
        resp = client.post("/api/projects", json={"name": "P"})
        data = resp.get_json()
        assert "prices" not in data
