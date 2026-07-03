package com.froggyriia.shiftplanner.domain.model

import java.util.UUID

data class CompanyBranchDraft(
    val localId: String = UUID.randomUUID().toString(),
    val remoteId: Int? = null,
    val name: String = "",
    val address: String = ""
)

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

// ── Extensions ────────────────────────────────────────────────────────────────

fun AppCompany.withBranches(branches: List<AppBranchOption>): AppCompany =
    copy(branches = branches)

fun AppCompany.withDetails(name: String, address: String?): AppCompany =
    copy(name = name, address = address)

fun AppCompany.withInviteCode(
    inviteCode: String,
    generatedAt: String?,
    expiresAt: String?
): AppCompany = copy(
    inviteCode = inviteCode,
    inviteCodeGeneratedAt = generatedAt,
    inviteCodeExpiresAt = expiresAt
)

fun AppCompanySummary.asAppCompany(): AppCompany = AppCompany(
    id = id,
    name = name,
    address = address,
    inviteCode = inviteCode ?: "",
    inviteCodeGeneratedAt = inviteCodeGeneratedAt,
    inviteCodeExpiresAt = inviteCodeExpiresAt,
    branches = emptyList()
)
