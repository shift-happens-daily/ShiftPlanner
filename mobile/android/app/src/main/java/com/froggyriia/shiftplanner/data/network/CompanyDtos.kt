package com.froggyriia.shiftplanner.data.network

import com.froggyriia.shiftplanner.domain.model.AppBranchOption
import com.froggyriia.shiftplanner.domain.model.AppCompany
import com.froggyriia.shiftplanner.domain.model.AppCompanyInvitePreview
import com.froggyriia.shiftplanner.domain.model.AppPositionOption
import com.google.gson.annotations.SerializedName

data class CompanyCreateRequestDto(
    val name: String
)

data class CompanyUpdateRequestDto(
    val name: String?,
    val address: String?
)

data class CompanyResponseDto(
    val id: Int,
    val name: String,
    val address: String?,
    @SerializedName("invite_code")
    val inviteCode: String,
    @SerializedName("invite_code_generated_at")
    val inviteCodeGeneratedAt: String?,
    @SerializedName("invite_code_expires_at")
    val inviteCodeExpiresAt: String?
) {
    fun toDomain(branches: List<AppBranchOption> = emptyList()): AppCompany = AppCompany(
        id = id,
        name = name,
        address = address,
        inviteCode = inviteCode,
        inviteCodeGeneratedAt = inviteCodeGeneratedAt,
        inviteCodeExpiresAt = inviteCodeExpiresAt,
        branches = branches
    )
}

data class BranchOptionResponseDto(
    val id: Int,
    val name: String,
    val address: String?
) {
    fun toDomain(): AppBranchOption = AppBranchOption(id = id, name = name, address = address)
}

data class CompanyBranchResponseDto(
    val id: Int,
    val name: String,
    val address: String?,
    @SerializedName("company_id")
    val companyId: Int
) {
    fun toDomain(): AppBranchOption = AppBranchOption(id = id, name = name, address = address)
}

data class CompanyBranchCreateRequestDto(
    val name: String,
    val address: String?
)

data class CompanyBranchUpdateRequestDto(
    val name: String?,
    val address: String?
)

data class PositionOptionResponseDto(
    val id: Int,
    val name: String
) {
    fun toDomain(): AppPositionOption = AppPositionOption(id = id, name = name)
}

data class CompanyInvitePreviewResponseDto(
    @SerializedName("company_id")
    val companyId: Int,
    @SerializedName("company_name")
    val companyName: String,
    @SerializedName("invite_code")
    val inviteCode: String,
    val branches: List<BranchOptionResponseDto>,
    val positions: List<PositionOptionResponseDto>
) {
    fun toDomain(): AppCompanyInvitePreview = AppCompanyInvitePreview(
        id = companyId,
        name = companyName,
        inviteCode = inviteCode,
        branches = branches.map { it.toDomain() },
        positions = positions.map { it.toDomain() }
    )
}

data class CompanyJoinRequestDto(
    @SerializedName("invite_code")
    val inviteCode: String,
    @SerializedName("branch_id")
    val branchId: Int?,
    @SerializedName("position_id")
    val positionId: Int?
)

data class CompanyJoinManagerRequestDto(
    @SerializedName("invite_code")
    val inviteCode: String
)

/** Value of the working-hours map: weekday ("0".."6") -> range in 30-min slots. */
data class WorkingHoursRangeDto(
    @SerializedName("start_slot")
    val startSlot: Int,
    @SerializedName("end_slot")
    val endSlot: Int
)
