from __future__ import annotations
from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.company import Branch, Company, Position


def _primary_link(links):
    if not links:
        return None
    return sorted(links, key=lambda item: (not item.is_primary, item.id))[0]


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
    max_hours_per_week: Mapped[int] = mapped_column(Integer, default=40, server_default="40")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    user: Mapped[User] = relationship(back_populates="employee")

    company: Mapped["Company"] = relationship()
    branch_links: Mapped[list["EmployeeBranch"]] = relationship(
        back_populates="employee",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    position_links: Mapped[list["EmployeePosition"]] = relationship(
        back_populates="employee",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

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

    @property
    def branch(self) -> "Branch | None":
        link = _primary_link(self.branch_links)
        return link.branch if link is not None else None

    @property
    def branch_id(self) -> int | None:
        branch = self.branch
        return branch.id if branch is not None else None

    @property
    def position(self) -> "Position | None":
        link = _primary_link(self.position_links)
        return link.position if link is not None else None

    @property
    def position_id(self) -> int | None:
        position = self.position
        return position.id if position is not None else None


class EmployeeBranch(Base):
    __tablename__ = "employee_branches"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"))
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id", ondelete="CASCADE"))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    employee: Mapped[Employee] = relationship(back_populates="branch_links")
    branch: Mapped["Branch"] = relationship(back_populates="employee_links")


class EmployeePosition(Base):
    __tablename__ = "employee_positions"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"))
    position_id: Mapped[int] = mapped_column(ForeignKey("positions.id", ondelete="CASCADE"))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    employee: Mapped[Employee] = relationship(back_populates="position_links")
    position: Mapped["Position"] = relationship(back_populates="employee_links")


class EmployeeAvailability(Base):
    __tablename__ = "employee_availability"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"))
    weekday: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    availability_status: Mapped[str] = mapped_column(String(20), default="available", server_default="available")

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
