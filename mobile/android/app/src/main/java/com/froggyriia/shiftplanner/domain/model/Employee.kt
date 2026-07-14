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
