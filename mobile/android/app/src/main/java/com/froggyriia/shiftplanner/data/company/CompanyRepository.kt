package com.froggyriia.shiftplanner.data.company

import com.froggyriia.shiftplanner.domain.model.AppBranchOption
import com.froggyriia.shiftplanner.domain.model.AppCompany
import com.froggyriia.shiftplanner.domain.model.AppCompanyInvitePreview
import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.domain.model.WorkingHoursRange

interface CompanyRepository {
    suspend fun createCompany(name: String): AppCompany
    suspend fun fetchMyCompany(): AppCompany
    suspend fun updateMyCompany(name: String?, address: String?): AppCompany
    suspend fun regenerateInviteCode(): AppCompany
    suspend fun fetchBranches(): List<AppBranchOption>
    suspend fun createBranch(name: String, address: String?): AppBranchOption
    suspend fun updateBranch(branchId: Int, name: String?, address: String?): AppBranchOption
    suspend fun deleteBranch(branchId: Int)

    // ── Branch working hours (weekday 0=Mon..6=Sun -> slot range) ────────────
    suspend fun fetchBranchWorkingHours(companyId: Int, branchId: Int): Map<Int, WorkingHoursRange>
    suspend fun updateBranchWorkingHours(
        companyId: Int,
        branchId: Int,
        hours: Map<Int, WorkingHoursRange>
    ): Map<Int, WorkingHoursRange>
    suspend fun previewInvite(code: String): AppCompanyInvitePreview
    suspend fun joinCompany(inviteCode: String, branchId: Int?, positionId: Int?): AppUser
    suspend fun joinCompanyAsManager(inviteCode: String): AppUser
}
