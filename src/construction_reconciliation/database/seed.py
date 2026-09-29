"""Explicit command for applying the repeatable synthetic sample data."""

from importlib.resources import files
import sys

from construction_reconciliation.database.session import get_session


def seed_database() -> None:
    """Apply the bundled idempotent sample SQL in one database transaction."""
    seed_sql = (
        files("construction_reconciliation.database")
        .joinpath("migrations", "002_seed_sample_data.sql")
        .read_text(encoding="utf-8")
    )
    session = get_session()
    try:
        session.connection().exec_driver_sql(seed_sql)
        session.commit()
        print("Synthetic sample data seeded; repeating this command is safe.")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def main() -> int:
    try:
        seed_database()
    except Exception as exc:
        # Do not print DB driver errors because they may include connection details.
        print(f"Database seeding failed ({type(exc).__name__}).", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
