package com.froggyriia.shiftplanner.domain.model

import java.util.Date

enum class AppScheduleStatus(val apiValue: String) {
    DRAFT("draft"),
    PUBLISHED("published"),
    ARCHIVED("archived");

    companion object {
        fun fromApiValue(value: String): AppScheduleStatus? =
            entries.firstOrNull { it.apiValue == value }
    }
}

enum class AppEmployeeAvailabilityStatus(val apiValue: String) {
    AVAILABLE("available"),
    IF_NEEDED("if_needed"),
    UNAVAILABLE("unavailable");

    companion object {
        fun fromApiValue(value: String): AppEmployeeAvailabilityStatus =
            entries.firstOrNull { it.apiValue == value } ?: UNAVAILABLE
    }
}

data class AppAvailableEmployee(
    val id: Int,
    val fullName: String,
    val positionName: String,
    val branchId: Int? = null,
    val branchName: String?,
    val availabilityStatus: AppEmployeeAvailabilityStatus,
    val assignedHours: Double
)

data class AppScheduledShift(
    val id: Int,
    val employeeId: Int?,
    val employeeName: String?,
    val positionId: Int,
    val positionName: String,
    val date: Date,
    val startMinutes: Int,
    val endMinutes: Int
) {
    val hasAssignedEmployee: Boolean get() = employeeId != null
}

data class AppUnfilledRequirement(
    val id: Int,
    val positionId: Int,
    val positionTitle: String,
    val date: Date,
    val startMinutes: Int,
    val endMinutes: Int,
    val missingStaff: Int
)

data class AppSchedule(
    val id: Int,
    val branchId: Int?,
    /** Period covered by this schedule; null when the backend didn't send it. */
    val startDate: Date?,
    val endDate: Date?,
    val status: AppScheduleStatus,
    val shifts: List<AppScheduledShift>,
    val unfilledRequirements: List<AppUnfilledRequirement>
)

data class ScheduleShiftMutation(
    val date: Date,
    val startMinutes: Int,
    val endMinutes: Int,
    val positionId: Int,
    val employeeId: Int?
)

/** Lightweight schedule descriptor from GET /schedule (list). */
data class AppScheduleListItem(
    val id: Int,
    val branchId: Int?,
    val startDate: Date,
    val endDate: Date,
    val status: AppScheduleStatus
)

/** A shift-exchange request raised by an employee, reviewed by a manager. */
data class PendingShiftExchange(
    val id: Int,
    val shiftId: Int,
    val employeeId: Int,
    val employeeName: String,
    val note: String,
    val status: String   // "pending" | "approved" | "rejected"
)
