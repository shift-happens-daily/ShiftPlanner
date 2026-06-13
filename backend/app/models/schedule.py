from datetime import date, datetime, time

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ShiftRequirement(Base):
    __tablename__ = "shift_requirements"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"))
    position_id: Mapped[int] = mapped_column(ForeignKey("positions.id", ondelete="CASCADE"))
    shift_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    required_employees: Mapped[int] = mapped_column(default=1, server_default="1")


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(50), default="draft", server_default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    shifts: Mapped[list["Shift"]] = relationship(back_populates="schedule", cascade="all, delete-orphan")


class Shift(Base):
    __tablename__ = "shifts"

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_id: Mapped[int | None] = mapped_column(ForeignKey("schedules.id", ondelete="CASCADE"))
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"))
    position_id: Mapped[int] = mapped_column(ForeignKey("positions.id", ondelete="CASCADE"))
    shift_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    schedule: Mapped[Schedule | None] = relationship(back_populates="shifts")
    assignments: Mapped[list["ShiftAssignment"]] = relationship(back_populates="shift", cascade="all, delete-orphan")


class ShiftAssignment(Base):
    __tablename__ = "shift_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    shift_id: Mapped[int] = mapped_column(ForeignKey("shifts.id", ondelete="CASCADE"))
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(50), default="assigned", server_default="assigned")

    shift: Mapped[Shift] = relationship(back_populates="assignments")
    exchange_requests: Mapped[list["ShiftExchangeRequest"]] = relationship(
        back_populates="shift_assignment",
        cascade="all, delete-orphan",
    )


class ShiftExchangeRequest(Base):
    __tablename__ = "shift_exchange_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    shift_assignment_id: Mapped[int] = mapped_column(ForeignKey("shift_assignments.id", ondelete="CASCADE"))
    requested_by_employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(50), default="pending", server_default="pending")
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    shift_assignment: Mapped[ShiftAssignment] = relationship(back_populates="exchange_requests")
