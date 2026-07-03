package com.froggyriia.shiftplanner.domain.model

import com.google.gson.annotations.SerializedName

data class AppUser(
    val id: String,
    val email: String,
    val name: String,
    val role: UserRole,
    val employeeId: Int? = null,
    val company: AppCompanySummary? = null,
    val branch: AppBranchOption? = null,
    val position: AppPositionOption? = null
) {
    val hasCompany: Boolean
        get() = company != null
}

data class AppCompanySummary(
    val id: Int,
    val name: String,
    val address: String?,
    val inviteCode: String?,
    val inviteCodeGeneratedAt: String?,
    val inviteCodeExpiresAt: String?
)

data class AppBranchOption(
    val id: Int,
    val name: String,
    val address: String?
)

data class AppPositionOption(
    val id: Int,
    val name: String
)

enum class UserRole(
    val title: String
) {
    @SerializedName("manager")
    MANAGER("Manager"),

    @SerializedName("employee")
    EMPLOYEE("Employee")
}
