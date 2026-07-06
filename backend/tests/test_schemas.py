from datetime import date, time
from pathlib import Path
import sys

import pytest
from pydantic import ValidationError

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.schemas.company import CompanyJoinRequest, CompanyUserPublicIdRequest, normalize_invite_code
from app.schemas.employee import AbsenceCreate, AvailabilityBlock, AvailabilityUpsert
from app.schemas.schedule import (
    ManualShiftCreate,
    ScheduleGenerateRequest,
    ScheduleRequirementBulkCreate,
    ScheduleRequirementCreate,
    ScheduleRequirementUpdate,
    ScheduleShiftUpdate,
)


def test_invite_and_public_id_inputs_are_normalized_and_validated() -> None:
    assert normalize_invite_code(" a7k9p2x4m8q1l5r3 ") == "A7K9P2X4M8Q1L5R3"
    assert CompanyJoinRequest(invite_code=" a7k9p2x4m8q1l5r3 ").invite_code == "A7K9P2X4M8Q1L5R3"
    assert CompanyUserPublicIdRequest(user_public_id="z9z9z9z9z9z9z9z9").user_public_id == "Z9Z9Z9Z9Z9Z9Z9Z9"

    with pytest.raises(ValueError):
        normalize_invite_code("too-short")
    with pytest.raises(ValidationError):
        CompanyUserPublicIdRequest(user_public_id="not-a-valid-id")


def test_availability_and_absence_schema_date_time_validation() -> None:
    block = AvailabilityBlock(
        weekday=2,
        start_time=time(9, 0),
        end_time=time(17, 0),
        availability_status="if_needed",
    )
    assert block.availability_status == "if_needed"

    with pytest.raises(ValidationError):
        AvailabilityBlock(weekday=7, start_time=time(9, 0), end_time=time(17, 0))
    with pytest.raises(ValidationError):
        AvailabilityBlock(weekday=1, start_time=time(17, 0), end_time=time(9, 0))
    with pytest.raises(ValidationError):
        AvailabilityUpsert(desired_days_off=[0, 8])
    with pytest.raises(ValidationError):
        AbsenceCreate(absence_type="vacation", start_date=date(2026, 7, 3), end_date=date(2026, 7, 1))


def test_requirement_schema_syncs_legacy_and_current_staff_fields() -> None:
    from_min_staff = ScheduleRequirementCreate(
        position_id=1,
        date=date(2026, 7, 1),
        min_staff=2,
        start_time=time(9, 0),
        end_time=time(17, 0),
    )
    assert from_min_staff.required_count == 2

    from_required_count = ScheduleRequirementCreate(
        position_id=1,
        date=date(2026, 7, 1),
        required_count=3,
        start_time=time(9, 0),
        end_time=time(17, 0),
    )
    assert from_required_count.min_staff == 3

    update = ScheduleRequirementUpdate(required_count=4)
    assert update.min_staff == 4
    with pytest.raises(ValidationError):
        ScheduleRequirementCreate(
            position_id=1,
            date=date(2026, 7, 1),
            start_time=time(17, 0),
            end_time=time(9, 0),
        )


def test_period_and_shift_payload_validators_reject_invalid_ranges() -> None:
    with pytest.raises(ValidationError):
        ScheduleRequirementBulkCreate(
            branch_id=1,
            start_date=date(2026, 7, 7),
            end_date=date(2026, 7, 1),
            weekdays=[0],
            requirements=[{"position_id": 1, "min_staff": 1, "start_time": "09:00", "end_time": "17:00"}],
        )
    with pytest.raises(ValidationError):
        ScheduleGenerateRequest(branch_id=1, start_date=date(2026, 7, 7), end_date=date(2026, 7, 1))
    with pytest.raises(ValidationError):
        ManualShiftCreate(
            date=date(2026, 7, 1),
            start_time=time(9, 2),
            end_time=time(17, 0),
            position_id=1,
        )
    with pytest.raises(ValidationError):
        ScheduleShiftUpdate(action="reassign")
