package com.froggyriia.shiftplanner.domain.model

data class ManagedEmployee(
    val id: Int,
    val publicId: String,
    val fullName: String,
    val email: String,
    val role: UserRole = UserRole.EMPLOYEE,
    val branchId: Int? = null,
    val branchName: String? = null,
    val positionId: Int? = null,
    val positionTitle: String? = null
)

data class ManagedPosition(
    val id: Int,
    val title: String
)

data class ManagedBranch(
    val id: Int,
    val name: String
)

data class PendingManagerRequest(
    val id: Int,
    val fullName: String,
    val email: String,
    val managerRole: String   // "owner" | "manager"
)

data class PendingEmployeeRequest(
    val id: Int,
    val fullName: String,
    val email: String,
    val positionId: Int?,
    val branchId: Int?
)

/** Employee work-hours limits (per week / per day). */
data class WorkLimits(
    val maxHoursPerWeek: Int,
    val maxHoursPerDay: Int
)

/** One branch an employee is assigned to (multi-branch), with the primary flag. */
data class ManagedBranchAssignment(
    val id: Int,
    val name: String,
    val isPrimary: Boolean
)

data class ManagedEmployeeCalendarShift(
    val date: String,
    val startMinutes: Int,
    val endMinutes: Int,
    val status: String
)

/** Manager-viewed calendar for one employee. */
data class ManagedEmployeeCalendar(
    val employeeName: String,
    val totalShifts: Int,
    val totalHours: Double,
    val shifts: List<ManagedEmployeeCalendarShift>
)
