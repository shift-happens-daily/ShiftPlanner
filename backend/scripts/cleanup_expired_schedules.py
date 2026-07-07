from pathlib import Path
import sys


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database import SessionLocal
from app.services.schedule_retention import cleanup_expired_schedules


def main() -> None:
    with SessionLocal() as db:
        deleted_count = cleanup_expired_schedules(db)
    print(f"Deleted {deleted_count} expired schedule(s).")


if __name__ == "__main__":
    main()
