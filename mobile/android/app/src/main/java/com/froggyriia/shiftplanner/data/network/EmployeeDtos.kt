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
