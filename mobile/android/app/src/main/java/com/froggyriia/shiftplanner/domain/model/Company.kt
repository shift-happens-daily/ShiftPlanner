package com.froggyriia.shiftplanner.domain.model

data class AppCompany(
    val id: Int,
    val name: String,
    val address: String?,
    val inviteCode: String,
    val inviteCodeGeneratedAt: String?,
    val inviteCodeExpiresAt: String?,
    val branches: List<AppBranchOption> = emptyList()
)

data class AppCompanyInvitePreview(
    val id: Int,
    val name: String,
    val inviteCode: String,
    val branches: List<AppBranchOption>,
    val positions: List<AppPositionOption>
)
