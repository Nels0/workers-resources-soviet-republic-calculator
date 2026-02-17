import pytest

from app import create_app
from app.database import Base, engine


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
