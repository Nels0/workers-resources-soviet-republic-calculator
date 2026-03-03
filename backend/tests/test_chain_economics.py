"""Tests for POST /api/projects/<id>/chains/auto-detect and
POST /api/projects/<id>/chain-economics."""
import pytest

from app import create_app
from app.database import Base, engine, get_session
from app.models import Building, BuildingFlow, Country, Project, ProjectBuilding, Resource


@pytest.fixture
def client():
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


def make_flow_buildings(session):
    """Creates Coal Mine (produces coal) + Steel Mill (consumes coal, produces steel)."""
    coal = Resource(name="Coal", type="material", unit="t")
    steel = Resource(name="Steel", type="material", unit="t")
    session.add_all([coal, steel])
    session.flush()

    mine = Building(name="Coal Mine", category="industry", source_file="coal_mine.ini",
                    workers_needed=5)
    mill = Building(name="Steel Mill", category="industry", source_file="steel_mill.ini",
                    workers_needed=10)
    session.add_all([mine, mill])
    session.flush()

    session.add(BuildingFlow(building_id=mine.id, resource_id=coal.id, quantity=2.4, direction="produces"))
    session.add(BuildingFlow(building_id=mill.id, resource_id=coal.id, quantity=2.0, direction="consumes"))
    session.add(BuildingFlow(building_id=mill.id, resource_id=steel.id, quantity=1.2, direction="produces"))
    session.commit()
    return mine, mill, coal, steel


class TestAutoDetect:
    def test_groups_buildings_sharing_a_resource(self, client):
        session = get_session()
        mine, mill, coal, steel = make_flow_buildings(session)
        mine_id, mill_id = mine.id, mill.id
        session.close()

        pid = client.post("/api/projects", json={"name": "P"}).get_json()["id"]
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mine_id})
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mill_id})

        resp = client.post(f"/api/projects/{pid}/chains/auto-detect")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["chains"]) == 1
        assert len(data["chains"][0]["members"]) == 2

    def test_names_chain_by_highest_produced_resource(self, client):
        session = get_session()
        mine, mill, coal, steel = make_flow_buildings(session)
        mine_id, mill_id = mine.id, mill.id
        session.close()

        pid = client.post("/api/projects", json={"name": "P"}).get_json()["id"]
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mine_id})
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mill_id})

        resp = client.post(f"/api/projects/{pid}/chains/auto-detect")
        data = resp.get_json()
        # mine produces 2.4 coal, mill produces 1.2 steel → coal wins
        assert data["chains"][0]["name"] == "Coal"

    def test_empty_project_returns_empty_chains(self, client):
        pid = client.post("/api/projects", json={"name": "P"}).get_json()["id"]
        resp = client.post(f"/api/projects/{pid}/chains/auto-detect")
        assert resp.status_code == 200
        assert resp.get_json() == {"chains": []}

    def test_does_not_save_chains(self, client):
        session = get_session()
        mine, mill, _, _ = make_flow_buildings(session)
        mine_id, mill_id = mine.id, mill.id
        session.close()

        pid = client.post("/api/projects", json={"name": "P"}).get_json()["id"]
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mine_id})
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mill_id})

        client.post(f"/api/projects/{pid}/chains/auto-detect")

        chains = client.get(f"/api/projects/{pid}/chains").get_json()
        assert chains == []

    def test_buildings_without_flows_are_excluded(self, client):
        session = get_session()
        mine, mill, _, _ = make_flow_buildings(session)
        warehouse = Building(name="Warehouse", category="logistics", source_file="wh.ini")
        session.add(warehouse)
        session.commit()
        mine_id, mill_id, wh_id = mine.id, mill.id, warehouse.id
        session.close()

        pid = client.post("/api/projects", json={"name": "P"}).get_json()["id"]
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mine_id})
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mill_id})
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": wh_id})

        resp = client.post(f"/api/projects/{pid}/chains/auto-detect")
        data = resp.get_json()
        assert len(data["chains"]) == 1
        assert len(data["chains"][0]["members"]) == 2  # warehouse excluded


class TestChainEconomics:
    def test_basic_produces_and_consumed(self, client):
        session = get_session()
        mine, mill, coal, steel = make_flow_buildings(session)
        mine_id, mill_id, coal_id, steel_id = mine.id, mill.id, str(coal.id), str(steel.id)
        session.close()

        pid = client.post("/api/projects", json={"name": "P"}).get_json()["id"]
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mine_id})
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mill_id})
        project = client.get(f"/api/projects/{pid}").get_json()
        pos0, pos1 = project["buildings"][0]["position"], project["buildings"][1]["position"]

        resp = client.post(f"/api/projects/{pid}/chain-economics", json={
            "period": "day",
            "positions": [pos0, pos1],
            "project_productivity": 1.0,
            "productivity_overrides": {},
        })
        assert resp.status_code == 200
        data = resp.get_json()

        # mine produces 2.4 * 1 * 5workers = 12 t coal/day (no input constraint)
        assert abs(data["produced"][coal_id] - 12.0) < 0.01
        # mill needs 2.0 * 1 * 10workers = 20 t coal/day, but mine only produces 12 →
        # mill cfactor = 12/20 = 0.6; post-constraint consumed = 20 * 0.6 = 12
        assert abs(data["consumed"][coal_id] - 12.0) < 0.01
        # mill steel post-constraint = 1.2 * 1 * 10workers * 0.6 = 7.2 t steel/day
        assert abs(data["produced"][steel_id] - 7.2) < 0.01

    def test_surplus_mine(self, client):
        session = get_session()
        mine, mill, coal, steel = make_flow_buildings(session)
        mine_id, mill_id, coal_id = mine.id, mill.id, str(coal.id)
        session.close()

        pid = client.post("/api/projects", json={"name": "P"}).get_json()["id"]
        # 2 mines, 1 mill
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mine_id, "quantity": 2})
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mill_id})
        project = client.get(f"/api/projects/{pid}").get_json()
        positions = [b["position"] for b in project["buildings"]]

        resp = client.post(f"/api/projects/{pid}/chain-economics", json={
            "period": "day",
            "positions": positions,
            "project_productivity": 1.0,
            "productivity_overrides": {},
        })
        data = resp.get_json()
        # coverage > 1 → surplus
        assert float(data["coverage"][coal_id]) > 1.0

    def test_constrained_mill(self, client):
        session = get_session()
        mine, mill, coal, steel = make_flow_buildings(session)
        mine_id, mill_id = mine.id, mill.id
        session.close()

        pid = client.post("/api/projects", json={"name": "P"}).get_json()["id"]
        # 1 mine, 2 mills → mill is constrained
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mine_id})
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mill_id, "quantity": 2})
        project = client.get(f"/api/projects/{pid}").get_json()
        positions = [b["position"] for b in project["buildings"]]

        resp = client.post(f"/api/projects/{pid}/chain-economics", json={
            "period": "day",
            "positions": positions,
            "project_productivity": 1.0,
            "productivity_overrides": {},
        })
        data = resp.get_json()
        mill_pos = str(project["buildings"][1]["position"])
        assert mill_pos in data["buildingUtilization"]
        assert float(data["buildingUtilization"][mill_pos]) < 1.0

    def test_productivity_override(self, client):
        session = get_session()
        mine, mill, coal, steel = make_flow_buildings(session)
        mine_id, mill_id, coal_id = mine.id, mill.id, str(coal.id)
        session.close()

        pid = client.post("/api/projects", json={"name": "P"}).get_json()["id"]
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mine_id})
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mill_id})
        project = client.get(f"/api/projects/{pid}").get_json()
        mine_pos = project["buildings"][0]["position"]
        positions = [b["position"] for b in project["buildings"]]

        resp = client.post(f"/api/projects/{pid}/chain-economics", json={
            "period": "day",
            "positions": positions,
            "project_productivity": 1.0,
            "productivity_overrides": {str(mine_pos): 0.5},
        })
        data = resp.get_json()
        # mine at 50%: 2.4 * 0.5 * 1 * 5workers = 6 t/day
        assert abs(data["produced"][coal_id] - 6.0) < 0.1

    def test_ruble_totals_with_prices(self, client):
        session = get_session()
        mine, mill, coal, steel = make_flow_buildings(session)
        mine_id, mill_id = mine.id, mill.id
        steel_id = steel.id
        session.close()

        # Create country with steel export price = 100
        country = client.post("/api/countries", json={"name": "USSR"}).get_json()
        cid = country["id"]
        client.put(f"/api/countries/{cid}/prices", json={
            "prices": {str(steel_id): {"import": 0, "export": 100}}
        })

        pid = client.post("/api/projects", json={"name": "P", "country_id": cid}).get_json()["id"]
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mine_id})
        client.post(f"/api/projects/{pid}/buildings", json={"buildingId": mill_id})
        project = client.get(f"/api/projects/{pid}").get_json()
        positions = [b["position"] for b in project["buildings"]]

        resp = client.post(f"/api/projects/{pid}/chain-economics", json={
            "period": "day",
            "positions": positions,
            "project_productivity": 1.0,
            "productivity_overrides": {},
        })
        data = resp.get_json()
        # mill at 60% cfactor: steel net = 7.2 t/day * 100 = 720 export rubles/day
        assert abs(data["exportRubles"] - 720.0) < 1.0
        assert data["importRubles"] == 0.0
        assert abs(data["netRubles"] - 720.0) < 1.0

    def test_invalid_period_returns_400(self, client):
        pid = client.post("/api/projects", json={"name": "P"}).get_json()["id"]
        resp = client.post(f"/api/projects/{pid}/chain-economics", json={
            "period": "decade",
            "positions": [],
        })
        assert resp.status_code == 400

    def test_project_not_found_returns_404(self, client):
        resp = client.post("/api/projects/nonexistent/chain-economics", json={
            "period": "month",
            "positions": [],
        })
        assert resp.status_code == 404
