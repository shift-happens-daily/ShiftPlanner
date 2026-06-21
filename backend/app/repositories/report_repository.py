from datetime import date

from sqlalchemy.orm import Session

from app.repositories import schedule_repository


def list_published_shift_rows(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
    company_id: int | None = None,
) -> list[dict]:
    return schedule_repository.list_published_shift_rows(
        db,
        start_date=start_date,
        end_date=end_date,
        company_id=company_id,
    )
