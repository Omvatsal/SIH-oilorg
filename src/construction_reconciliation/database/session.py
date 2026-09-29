from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from construction_reconciliation.config import get_settings


class Base(DeclarativeBase):
    pass


class DatabaseNotConfiguredError(RuntimeError):
    """Raised when a database operation is attempted without DATABASE_URL."""


@lru_cache
def get_engine():
    database_url = get_settings().database_url.strip()
    if not database_url:
        raise DatabaseNotConfiguredError(
            "DATABASE_URL is empty. Set it in the project .env file first."
        )
    return create_engine(database_url, pool_pre_ping=True)


def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_session() -> Session:
    """Create a SQLAlchemy session. Callers own and must close the result."""
    return get_session_factory()()
