from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from . import config

engine = create_engine(config.SQLALCHEMY_DATABASE_URI)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def init_db():
    from . import models  # noqa: F401 — ensure models are registered

    Base.metadata.create_all(bind=engine)


def get_session() -> Session:
    return SessionLocal()
