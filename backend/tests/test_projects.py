import pytest

from app import create_app
from app.database import Base, engine, get_session
from app.models import Resource


@pytest.fixture
def client():
    """Create a fresh test client with an empty database for each test."""
    # Use in-memory DB by swapping the engine
    import app.config as config

    original_uri = config.SQLALCHEMY_DATABASE_URI
    config.SQLALCHEMY_DATABASE_URI = "sqlite://"

    # Re-create engine for in-memory DB
    import app.database as db

    db.engine = db.create_engine(config.SQLALCHEMY_DATABASE_URI)
    db.SessionLocal = db.sessionmaker(bind=db.engine)

    app = create_app()
    app.config["TESTING"] = True

    with app.test_client() as client:
        yield client

    # Restore original config
    config.SQLALCHEMY_DATABASE_URI = original_uri
    db.engine = engine
    db.SessionLocal = db.sessionmaker(bind=engine)


class TestCreateProject:
    def test_create_project_returns_201(self, client):
        resp = client.post("/api/projects", json={"name": "My Project"})
        assert resp.status_code == 201

    def test_create_project_returns_project_data(self, client):
        resp = client.post("/api/projects", json={"name": "My Project"})
        data = resp.get_json()
        assert data["name"] == "My Project"
        assert "id" in data
        assert data["buildings"] == []

    def test_create_project_generates_uuid(self, client):
        resp = client.post("/api/projects", json={"name": "Test"})
        data = resp.get_json()
        # UUID format: 8-4-4-4-12 hex chars
        parts = data["id"].split("-")
        assert len(parts) == 5

    def test_create_project_persists(self, client):
        resp = client.post("/api/projects", json={"name": "Persisted"})
        project_id = resp.get_json()["id"]

        resp = client.get("/api/projects")
        projects = resp.get_json()
        assert len(projects) == 1
        assert projects[0]["id"] == project_id
        assert projects[0]["name"] == "Persisted"

    def test_create_project_strips_whitespace(self, client):
        resp = client.post("/api/projects", json={"name": "  Trimmed  "})
        assert resp.get_json()["name"] == "Trimmed"

    def test_create_project_empty_name_returns_400(self, client):
        resp = client.post("/api/projects", json={"name": ""})
        assert resp.status_code == 400

    def test_create_project_whitespace_only_name_returns_400(self, client):
        resp = client.post("/api/projects", json={"name": "   "})
        assert resp.status_code == 400

    def test_create_project_missing_name_returns_400(self, client):
        resp = client.post("/api/projects", json={})
        assert resp.status_code == 400

    def test_create_project_no_body_returns_400(self, client):
        resp = client.post("/api/projects", content_type="application/json")
        assert resp.status_code == 400

    def test_create_multiple_projects(self, client):
        client.post("/api/projects", json={"name": "First"})
        client.post("/api/projects", json={"name": "Second"})

        resp = client.get("/api/projects")
        projects = resp.get_json()
        assert len(projects) == 2
        names = [p["name"] for p in projects]
        assert "First" in names
        assert "Second" in names


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


class TestProjectPrices:
    def test_new_project_has_empty_prices(self, client_with_resources):
        resp = client_with_resources.post("/api/projects", json={"name": "Test"})
        data = resp.get_json()
        assert data["prices"] == {}

    def test_put_prices_persists(self, client_with_resources):
        resp = client_with_resources.post("/api/projects", json={"name": "Test"})
        pid = resp.get_json()["id"]

        resp = client_with_resources.put(f"/api/projects/{pid}/prices", json={
            "prices": {"1": 10.5, "2": 20.0}
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["prices"] == {"1": 10.5, "2": 20.0}

    def test_get_prices_returns_dict(self, client_with_resources):
        resp = client_with_resources.post("/api/projects", json={"name": "Test"})
        pid = resp.get_json()["id"]

        client_with_resources.put(f"/api/projects/{pid}/prices", json={
            "prices": {"1": 10.5}
        })

        resp = client_with_resources.get(f"/api/projects/{pid}/prices")
        assert resp.status_code == 200
        assert resp.get_json() == {"1": 10.5}

    def test_put_prices_same_resource_twice_does_not_error(self, client_with_resources):
        """Regression: second PUT for an already-priced resource must not raise UNIQUE constraint."""
        resp = client_with_resources.post("/api/projects", json={"name": "Test"})
        pid = resp.get_json()["id"]

        client_with_resources.put(f"/api/projects/{pid}/prices", json={
            "prices": {"1": 10.0}
        })
        resp = client_with_resources.put(f"/api/projects/{pid}/prices", json={
            "prices": {"1": 312.0}
        })
        assert resp.status_code == 200
        assert resp.get_json()["prices"] == {"1": 312.0}

    def test_put_prices_replaces_all(self, client_with_resources):
        resp = client_with_resources.post("/api/projects", json={"name": "Test"})
        pid = resp.get_json()["id"]

        client_with_resources.put(f"/api/projects/{pid}/prices", json={
            "prices": {"1": 10.0, "2": 20.0}
        })
        resp = client_with_resources.put(f"/api/projects/{pid}/prices", json={
            "prices": {"3": 5.0}
        })
        data = resp.get_json()
        assert data["prices"] == {"3": 5.0}

    def test_zero_prices_not_stored(self, client_with_resources):
        resp = client_with_resources.post("/api/projects", json={"name": "Test"})
        pid = resp.get_json()["id"]

        resp = client_with_resources.put(f"/api/projects/{pid}/prices", json={
            "prices": {"1": 10.0, "2": 0}
        })
        data = resp.get_json()
        assert data["prices"] == {"1": 10.0}

    def test_null_prices_not_stored(self, client_with_resources):
        resp = client_with_resources.post("/api/projects", json={"name": "Test"})
        pid = resp.get_json()["id"]

        resp = client_with_resources.put(f"/api/projects/{pid}/prices", json={
            "prices": {"1": 10.0, "2": None}
        })
        data = resp.get_json()
        assert data["prices"] == {"1": 10.0}

    def test_prices_404_for_nonexistent_project(self, client_with_resources):
        resp = client_with_resources.get("/api/projects/nonexistent/prices")
        assert resp.status_code == 404

        resp = client_with_resources.put("/api/projects/nonexistent/prices", json={
            "prices": {"1": 10.0}
        })
        assert resp.status_code == 404

    def test_put_prices_400_for_missing_body(self, client_with_resources):
        resp = client_with_resources.post("/api/projects", json={"name": "Test"})
        pid = resp.get_json()["id"]

        resp = client_with_resources.put(f"/api/projects/{pid}/prices",
                                         content_type="application/json")
        assert resp.status_code == 400

    def test_delete_project_cascades_prices(self, client_with_resources):
        resp = client_with_resources.post("/api/projects", json={"name": "Test"})
        pid = resp.get_json()["id"]

        client_with_resources.put(f"/api/projects/{pid}/prices", json={
            "prices": {"1": 10.0}
        })

        resp = client_with_resources.delete(f"/api/projects/{pid}")
        assert resp.status_code == 200

        resp = client_with_resources.get(f"/api/projects/{pid}/prices")
        assert resp.status_code == 404

    def test_prices_included_in_project_list(self, client_with_resources):
        resp = client_with_resources.post("/api/projects", json={"name": "Test"})
        pid = resp.get_json()["id"]

        client_with_resources.put(f"/api/projects/{pid}/prices", json={
            "prices": {"1": 10.0}
        })

        resp = client_with_resources.get("/api/projects")
        projects = resp.get_json()
        assert projects[0]["prices"] == {"1": 10.0}

    def test_import_with_prices(self, client_with_resources):
        resp = client_with_resources.post("/api/projects/import", json={
            "projects": [{
                "name": "Imported",
                "buildings": [],
                "prices": {"1": 15.0, "2": 25.0}
            }]
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data[0]["prices"] == {"1": 15.0, "2": 25.0}
