from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String
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

    def to_dict(self, include_costs=False):
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


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    buildings: Mapped[list["ProjectBuilding"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="ProjectBuilding.position"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "buildings": [
                {"buildingId": pb.building_id, "quantity": pb.quantity, "position": pb.position}
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

    project: Mapped["Project"] = relationship(back_populates="buildings")
