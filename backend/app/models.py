from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import ForeignKey, Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Resource(Base):
    __tablename__ = "resources"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    type: Mapped[str] = mapped_column(String(50))  # material, workforce, money
    unit: Mapped[str] = mapped_column(String(30), default="t")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "type": self.type, "unit": self.unit}


class Building(Base):
    __tablename__ = "buildings"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100), default="")
    source_file: Mapped[str] = mapped_column(String(300), default="")
    workers_needed: Mapped[int] = mapped_column(default=0)
    construction_days: Mapped[float] = mapped_column(default=0.0)

    costs: Mapped[list["BuildingCost"]] = relationship(back_populates="building", cascade="all, delete-orphan")
    flows: Mapped[list["BuildingFlow"]] = relationship(back_populates="building", cascade="all, delete-orphan")

    def to_dict(self, include_costs=False, include_flows=False):
        d = {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "source_file": self.source_file,
            "workers_needed": self.workers_needed,
            "construction_days": self.construction_days,
        }
        if include_costs:
            d["costs"] = [c.to_dict() for c in self.costs]
        if include_flows:
            d["flows"] = [f.to_dict() for f in self.flows]
        return d


class BuildingCost(Base):
    __tablename__ = "building_costs"

    id: Mapped[int] = mapped_column(primary_key=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id"))
    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id"))
    quantity: Mapped[float] = mapped_column(default=0.0)
    phase: Mapped[str] = mapped_column(String(20), default="construction")  # construction | operation

    building: Mapped["Building"] = relationship(back_populates="costs")
    resource: Mapped["Resource"] = relationship()

    def to_dict(self):
        return {
            "id": self.id,
            "resource": self.resource.to_dict() if self.resource else None,
            "quantity": self.quantity,
            "phase": self.phase,
        }


class BuildingFlow(Base):
    __tablename__ = "building_flows"

    id: Mapped[int] = mapped_column(primary_key=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id"))
    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id"))
    quantity: Mapped[float] = mapped_column(default=0.0)
    direction: Mapped[str] = mapped_column(String(10))  # "produces" | "consumes"

    building: Mapped["Building"] = relationship(back_populates="flows")
    resource: Mapped["Resource"] = relationship()

    def to_dict(self):
        return {
            "id": self.id,
            "resource": self.resource.to_dict() if self.resource else None,
            "quantity": self.quantity,
            "direction": self.direction,
        }


class Country(Base):
    __tablename__ = "countries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    projects: Mapped[list["Project"]] = relationship(back_populates="country")
    prices: Mapped[list["CountryResourcePrice"]] = relationship(
        back_populates="country", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at.isoformat(),
        }


class CountryResourcePrice(Base):
    __tablename__ = "country_resource_prices"
    __table_args__ = (UniqueConstraint("country_id", "resource_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    country_id: Mapped[str] = mapped_column(ForeignKey("countries.id"))
    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id"))
    price: Mapped[float] = mapped_column(Float, default=0.0)
    import_price: Mapped[float] = mapped_column(Float, default=0.0)
    export_price: Mapped[float] = mapped_column(Float, default=0.0)

    country: Mapped["Country"] = relationship(back_populates="prices")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    country_id: Mapped[str | None] = mapped_column(ForeignKey("countries.id"), nullable=True, default=None)
    productivity: Mapped[float] = mapped_column(Float, default=1.0)

    buildings: Mapped[list["ProjectBuilding"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="ProjectBuilding.position"
    )
    country: Mapped["Country | None"] = relationship(back_populates="projects")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "country_id": self.country_id,
            "productivity": self.productivity if self.productivity is not None else 1.0,
            "buildings": [
                {
                    "buildingId": pb.building_id,
                    "quantity": pb.quantity,
                    "position": pb.position,
                    "productivity": pb.productivity,
                }
                for pb in self.buildings
            ],
        }


class ProjectBuilding(Base):
    __tablename__ = "project_buildings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"))
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id"))
    quantity: Mapped[int] = mapped_column(default=1)
    position: Mapped[int] = mapped_column(default=0)
    productivity: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)

    project: Mapped["Project"] = relationship(back_populates="buildings")


class ProjectChain(Base):
    __tablename__ = "project_chains"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"))
    name: Mapped[str] = mapped_column(String(200))
    position: Mapped[int] = mapped_column(Integer, default=0)

    members: Mapped[list["ProjectChainMember"]] = relationship(
        "ProjectChainMember", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "position": self.position,
            "members": sorted([m.building_pos for m in self.members]),
        }


class ProjectChainMember(Base):
    __tablename__ = "project_chain_members"
    __table_args__ = (UniqueConstraint("chain_id", "building_pos"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    chain_id: Mapped[str] = mapped_column(ForeignKey("project_chains.id"))
    building_pos: Mapped[int] = mapped_column(Integer)
