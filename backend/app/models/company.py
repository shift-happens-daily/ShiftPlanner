from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import Employee, User


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

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.current_timestamp(),
    )

    manager_links: Mapped[list["CompanyManager"]] = relationship(
        back_populates="company",
        cascade="all, delete-orphan",
        passive_deletes=True,
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

    @property
    def manager_user_id(self) -> int | None:
        if not self.manager_links:
            return None
        owner = next((link for link in self.manager_links if link.manager_role == "owner"), None)
        return (owner or sorted(self.manager_links, key=lambda item: item.id)[0]).user_id


class CompanyManager(Base):
    __tablename__ = "company_managers"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    manager_role: Mapped[str] = mapped_column(String(50), default="manager", server_default="manager")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    company: Mapped[Company] = relationship(back_populates="manager_links")
    user: Mapped["User"] = relationship()


class Branch(Base):
    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"),
    )
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)

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
