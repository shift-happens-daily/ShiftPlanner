from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import Employee, EmployeeBranch, EmployeePosition, User


def default_working_hours_by_weekday() -> dict[str, dict[str, int]]:
    return {
        str(weekday): {"start_slot": 0, "end_slot": 48}
        for weekday in range(7)
    }


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    invite_code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    invite_code_generated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.current_timestamp(),
    )
    invite_code_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    manager_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.current_timestamp(),
    )

    branches: Mapped[list["Branch"]] = relationship(
        back_populates="company",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    positions: Mapped[list["Position"]] = relationship(
        back_populates="company",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    manager_memberships: Mapped[list["CompanyManager"]] = relationship(
        back_populates="company",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Branch(Base):
    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"),
    )
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    working_hours_by_weekday: Mapped[dict] = mapped_column(
        JSONB,
        default=default_working_hours_by_weekday,
        server_default='{"0":{"start_slot":0,"end_slot":48},"1":{"start_slot":0,"end_slot":48},"2":{"start_slot":0,"end_slot":48},"3":{"start_slot":0,"end_slot":48},"4":{"start_slot":0,"end_slot":48},"5":{"start_slot":0,"end_slot":48},"6":{"start_slot":0,"end_slot":48}}',
    )

    company: Mapped[Company] = relationship(back_populates="branches")
    employee_links: Mapped[list["EmployeeBranch"]] = relationship(
        back_populates="branch",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"),
    )
    name: Mapped[str] = mapped_column(String(100))

    company: Mapped[Company] = relationship(back_populates="positions")
    employee_links: Mapped[list["EmployeePosition"]] = relationship(
        back_populates="position",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def employees(self) -> list["Employee"]:
        return [link.employee for link in self.employee_links]


class CompanyManager(Base):
    __tablename__ = "company_managers"
    __table_args__ = (
        UniqueConstraint("company_id", "user_id", name="uq_company_managers_company_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    manager_role: Mapped[str] = mapped_column(String(50), default="manager", server_default="manager")
    membership_status: Mapped[str] = mapped_column(String(50), default="pending", server_default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    company: Mapped[Company] = relationship(back_populates="manager_memberships")
