from __future__ import annotations
from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.company import Branch, Company, Position
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(50))
    is_registration_complete: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.current_timestamp(),
    )

    employee: Mapped["Employee | None"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"))
    branch_id: Mapped[int | None] = mapped_column(ForeignKey("branches.id", ondelete="SET NULL"))
    position_id: Mapped[int | None] = mapped_column(ForeignKey("positions.id", ondelete="SET NULL"))
    max_hours_per_week: Mapped[int] = mapped_column(Integer, default=40, server_default="40")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    user: Mapped[User] = relationship(back_populates="employee")

    company: Mapped["Company"] = relationship()
    branch: Mapped["Branch | None"] = relationship()
    position: Mapped["Position | None"] = relationship(back_populates="employees")

    availability_blocks: Mapped[list["EmployeeAvailability"]] = relationship(
        back_populates="employee",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    desired_days_off: Mapped[list["EmployeeDesiredDayOff"]] = relationship(
        back_populates="employee",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class EmployeeAvailability(Base):
    __tablename__ = "employee_availability"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"))
    weekday: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)

    employee: Mapped[Employee] = relationship(back_populates="availability_blocks")


class EmployeeDesiredDayOff(Base):
    __tablename__ = "employee_desired_days_off"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"))
    weekday: Mapped[int] = mapped_column(Integer)

    employee: Mapped[Employee] = relationship(back_populates="desired_days_off")


class Absence(Base):
    __tablename__ = "absences"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"))
    absence_type: Mapped[str] = mapped_column(String(50))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    comment: Mapped[str | None] = mapped_column(Text)
