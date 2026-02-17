import pytest

from app import create_app
from app.database import Base, engine, get_session
from app.models import Building


@pytest.fixture
def client():
    """Create a fresh test client with an empty database for each test."""
    import app.config as config

    original_uri = config.SQLALCHEMY_DATABASE_URI
    config.SQLALCHEMY_DATABASE_URI = "sqlite://"

    import app.database as db

    db.engine = db.create_engine(config.SQLALCHEMY_DATABASE_URI)
    db.SessionLocal = db.sessionmaker(bind=db.engine)

    app = create_app()
    app.config["TESTING"] = True

    with app.test_client() as client:
        yield client

    config.SQLALCHEMY_DATABASE_URI = original_uri
    db.engine = engine
    db.SessionLocal = db.sessionmaker(bind=engine)


@pytest.fixture
def seeded_client(client):
    """Client with a few buildings pre-loaded."""
    session = get_session()
    try:
        session.add_all([
            Building(name="Hospital", category="health", source_file="hospital.ini"),
            Building(name="Hospital", category="health", source_file="hospital_v2.ini"),
            Building(name="Cement plant", category="industry", source_file="cement_plant.ini"),
            Building(name="Cement plant", category="industry", source_file="cement_plant_v2.ini"),
            Building(name="Village house", category="residential", source_file="civ_dedina1a.ini"),
        ])
        session.commit()
    finally:
        session.close()
    return client


class TestBuildingSearch:
    def test_search_by_name(self, seeded_client):
        resp = seeded_client.get("/api/buildings?search=Hospital")
        data = resp.get_json()
        assert len(data["buildings"]) == 2
        assert all(b["name"] == "Hospital" for b in data["buildings"])

    def test_search_by_source_file(self, seeded_client):
        resp = seeded_client.get("/api/buildings?search=hospital_v2")
        data = resp.get_json()
        assert len(data["buildings"]) == 1
        assert data["buildings"][0]["source_file"] == "hospital_v2.ini"

    def test_search_by_source_file_partial(self, seeded_client):
        resp = seeded_client.get("/api/buildings?search=cement_plant")
        data = resp.get_json()
        assert len(data["buildings"]) == 2
        sources = {b["source_file"] for b in data["buildings"]}
        assert sources == {"cement_plant.ini", "cement_plant_v2.ini"}

    def test_search_by_source_file_case_insensitive(self, seeded_client):
        resp = seeded_client.get("/api/buildings?search=CIV_DEDINA")
        data = resp.get_json()
        assert len(data["buildings"]) == 1
        assert data["buildings"][0]["source_file"] == "civ_dedina1a.ini"

    def test_search_no_match(self, seeded_client):
        resp = seeded_client.get("/api/buildings?search=nonexistent")
        data = resp.get_json()
        assert len(data["buildings"]) == 0

    def test_empty_search_returns_all(self, seeded_client):
        resp = seeded_client.get("/api/buildings")
        data = resp.get_json()
        assert len(data["buildings"]) == 5

    def test_response_includes_source_file(self, seeded_client):
        resp = seeded_client.get("/api/buildings")
        data = resp.get_json()
        for b in data["buildings"]:
            assert "source_file" in b
            assert b["source_file"].endswith(".ini")

    def test_building_detail_includes_source_file(self, seeded_client):
        # Get a building ID first
        resp = seeded_client.get("/api/buildings?search=hospital_v2")
        building_id = resp.get_json()["buildings"][0]["id"]

        resp = seeded_client.get(f"/api/buildings/{building_id}")
        data = resp.get_json()
        assert data["source_file"] == "hospital_v2.ini"
