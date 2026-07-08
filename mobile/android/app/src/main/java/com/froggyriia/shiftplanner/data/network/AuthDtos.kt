package com.froggyriia.shiftplanner.data.network

import com.froggyriia.shiftplanner.domain.model.AppBranchOption
import com.froggyriia.shiftplanner.domain.model.AppCompanySummary
import com.froggyriia.shiftplanner.domain.model.AppPositionOption
import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.domain.model.UserRole
import com.google.gson.annotations.SerializedName

data class LoginRequestDto(
    val email: String,
    val password: String
)

data class LoginResponseDto(
    @SerializedName("access_token")
    val accessToken: String,
    @SerializedName("token_type")
    val tokenType: String,
    val role: UserRole
)

data class RegisterRequestDto(
    @SerializedName("full_name")
    val fullName: String,
    val email: String,
    val password: String,
    val role: UserRole
)

data class RegisterResponseDto(
    val id: Int,
    @SerializedName("full_name")
    val fullName: String,
    val email: String,
    val role: UserRole,
    @SerializedName("employee_id")
    val employeeId: Int?,
    @SerializedName("email_verification_required")
    val emailVerificationRequired: Boolean = false
)

data class CurrentUserResponseDto(
    val id: Int,
    @SerializedName("full_name")
    val fullName: String,
    val email: String,
    val role: UserRole,
    @SerializedName("employee_id")
    val employeeId: Int?,
    val company: CurrentUserCompanyDto?,
    val branch: CurrentUserBranchDto?,
    val position: CurrentUserPositionDto?
) {
    fun toAppUser(): AppUser {
        return AppUser(
            id = id.toString(),
            email = email,
            name = fullName,
            role = role,
            employeeId = employeeId,
            company = company?.toDomain(),
            branch = branch?.toDomain(),
            position = position?.toDomain()
        )
    }
}

data class CurrentUserCompanyDto(
    val id: Int,
    val name: String,
    val address: String?,
    @SerializedName("invite_code")
    val inviteCode: String?,
    @SerializedName("invite_code_generated_at")
    val inviteCodeGeneratedAt: String?,
    @SerializedName("invite_code_expires_at")
    val inviteCodeExpiresAt: String?
) {
    fun toDomain(): AppCompanySummary {
        return AppCompanySummary(
            id = id,
            name = name,
            address = address,
            inviteCode = inviteCode,
            inviteCodeGeneratedAt = inviteCodeGeneratedAt,
            inviteCodeExpiresAt = inviteCodeExpiresAt
        )
    }
}

data class CurrentUserBranchDto(
    val id: Int,
    val name: String,
    val address: String?
) {
    fun toDomain(): AppBranchOption {
        return AppBranchOption(
            id = id,
            name = name,
            address = address
        )
    }
}

data class CurrentUserPositionDto(
    val id: Int,
    val name: String
) {
    fun toDomain(): AppPositionOption {
        return AppPositionOption(
            id = id,
            name = name
        )
    }
}
