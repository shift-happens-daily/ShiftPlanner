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
