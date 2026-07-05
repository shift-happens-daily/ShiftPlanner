from datetime import date

from sqlalchemy import text
from sqlalchemy.orm import Session


def cleanup_expired_schedules(db: Session, reference_date: date | None = None) -> int:
    """Delete schedules older than the 3-month retention window."""

    if reference_date is None:
        result = db.execute(
            text(
                """
                DELETE FROM schedules
                WHERE end_date < CURRENT_DATE - INTERVAL '3 months'
                """
            )
        )
    else:
        result = db.execute(
            text(
                """
                DELETE FROM schedules
                WHERE end_date < CAST(:reference_date AS date) - INTERVAL '3 months'
                """
            ),
            {"reference_date": reference_date},
        )
    db.commit()
    return result.rowcount or 0
