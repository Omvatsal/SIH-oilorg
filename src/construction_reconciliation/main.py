"""Minimal FastAPI application entry point."""

import argparse
import sys

from fastapi import FastAPI

app = FastAPI(title="Construction Reconciliation API")


@app.get("/health")
def health() -> dict[str, str]:
    """Return process health without depending on external services."""
    return {"status": "ok"}


def run_dev_server(*, seed: bool = False) -> int:
    """Start the local server, optionally applying sample data first."""
    if seed:
        # Import only for explicit seed runs; app import and normal startup stay DB-free.
        from construction_reconciliation.database.seed import seed_database

        try:
            seed_database()
        except Exception as exc:
            # Driver error text can contain connection details; keep output generic.
            print(f"Database seeding failed ({type(exc).__name__}).", file=sys.stderr)
            return 1

    import uvicorn

    uvicorn.run(
        "construction_reconciliation.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )
    return 0


def _main() -> int:
    parser = argparse.ArgumentParser(description="Run the local reconciliation API.")
    parser.add_argument(
        "--seed",
        action="store_true",
        help="apply the repeatable sample data before starting the API",
    )
    args = parser.parse_args()
    return run_dev_server(seed=args.seed)


if __name__ == "__main__":
    raise SystemExit(_main())
