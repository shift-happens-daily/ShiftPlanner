package com.froggyriia.shiftplanner.data.network

import com.froggyriia.shiftplanner.domain.model.ManagedBranch
import com.froggyriia.shiftplanner.domain.model.ManagedEmployee
import com.froggyriia.shiftplanner.domain.model.ManagedPosition
import com.froggyriia.shiftplanner.domain.model.UserRole
import com.google.gson.annotations.SerializedName

data class EmployeeCreateRequestDto(
    @SerializedName("full_name")
    val fullName: String,
    val email: String,
    @SerializedName("position_id")
    val positionId: Int
)

data class EmployeePositionUpdateRequestDto(
    @SerializedName("position_id")
    val positionId: Int?
)

data class EmployeeBranchUpdateRequestDto(
    @SerializedName("branch_id")
    val branchId: Int?
)

data class EmployeeBranchSummaryDto(
    val id: Int,
    val name: String
)

data class EmployeePositionSummaryDto(
    val id: Int,
    val name: String
)

data class EmployeeResponseDto(
    val id: Int,
    @SerializedName("public_id")
    val publicId: String,
    @SerializedName("full_name")
    val fullName: String,
    val email: String,
    val role: UserRole,
    @SerializedName("branch_id")
    val branchId: Int?,
    val branch: EmployeeBranchSummaryDto?,
    @SerializedName("position_id")
    val positionId: Int?,
    @SerializedName("position_title")
    val positionTitle: String?,
    val position: EmployeePositionSummaryDto?
) {
    fun toDomain(): ManagedEmployee {
        val resolvedPositionId = positionId ?: position?.id
        val resolvedPositionTitle = positionTitle?.takeIf { it.isNotEmpty() }
            ?: position?.name?.takeIf { it.isNotEmpty() }
        return ManagedEmployee(
            id = id,
            publicId = publicId,
            fullName = fullName,
            email = email,
            role = role,
            branchId = branchId,
            branchName = branch?.name,
            positionId = resolvedPositionId,
            positionTitle = resolvedPositionTitle
        )
    }
}

data class PositionResponseDto(
    val id: Int,
    val title: String,
    @SerializedName("company_id")
    val companyId: Int?
) {
    fun toDomain(): ManagedPosition = ManagedPosition(id = id, title = title)
}

data class PositionCreateRequestDto(
    val title: String,
    @SerializedName("company_id")
    val companyId: Int
)

data class EmployeeBranchResponseDto(
    val id: Int,
    val name: String,
    @SerializedName("company_id")
    val companyId: Int
) {
    fun toDomain(): ManagedBranch = ManagedBranch(id = id, name = name)
}

data class ManagerRequestDto(
    val id: Int,
    @SerializedName("company_id") val companyId: Int,
    @SerializedName("user_id") val userId: Int,
    @SerializedName("public_id") val publicId: String,
    @SerializedName("full_name") val fullName: String,
    val email: String,
    @SerializedName("manager_role") val managerRole: String,
    @SerializedName("membership_status") val membershipStatus: String
) {
    fun toDomain() = com.froggyriia.shiftplanner.domain.model.PendingManagerRequest(
        id = id, fullName = fullName, email = email, managerRole = managerRole
    )
}

data class EmployeeRequestDto(
    val id: Int,
    @SerializedName("company_id") val companyId: Int,
    @SerializedName("user_id") val userId: Int,
    @SerializedName("public_id") val publicId: String,
    @SerializedName("full_name") val fullName: String,
    val email: String,
    @SerializedName("branch_id") val branchId: Int?,
    @SerializedName("position_id") val positionId: Int?,
    @SerializedName("is_active") val isActive: Boolean
) {
    fun toDomain() = com.froggyriia.shiftplanner.domain.model.PendingEmployeeRequest(
        id = id, fullName = fullName, email = email,
        positionId = positionId, branchId = branchId
    )
}

data class LinkUserRequestDto(
    @SerializedName("user_public_id") val userPublicId: String,
    @SerializedName("branch_id") val branchId: Int? = null,
    @SerializedName("position_id") val positionId: Int? = null
)

data class LinkedEmployeeResponseDto(
    val id: Int,
    @SerializedName("public_id") val publicId: String,
    @SerializedName("full_name") val fullName: String,
    val email: String,
    @SerializedName("branch_id") val branchId: Int?,
    @SerializedName("position_id") val positionId: Int?
) {
    fun toDomain() = ManagedEmployee(
        id = id, publicId = publicId, fullName = fullName, email = email,
        branchId = branchId, positionId = positionId
    )
}

/** GET/PATCH /employees/{id}/work-limits */
data class EmployeeWorkLimitsDto(
    @SerializedName("max_hours_per_week")
    val maxHoursPerWeek: Int,
    @SerializedName("max_hours_per_day")
    val maxHoursPerDay: Int
)

data class EmployeeBranchAssignmentDto(
    val id: Int,
    val name: String,
    @SerializedName("is_primary")
    val isPrimary: Boolean = false
)

data class EmployeeBranchesUpdateDto(
    @SerializedName("branch_ids")
    val branchIds: List<Int>,
    @SerializedName("primary_branch_id")
    val primaryBranchId: Int
)

data class EmployeeWorkloadDto(
    @SerializedName("total_shifts")
    val totalShifts: Int = 0,
    @SerializedName("total_hours")
    val totalHours: Double = 0.0
)
