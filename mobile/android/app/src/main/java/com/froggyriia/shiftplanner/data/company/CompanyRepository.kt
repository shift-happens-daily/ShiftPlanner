package com.froggyriia.shiftplanner.data.company

import com.froggyriia.shiftplanner.domain.model.AppBranchOption
import com.froggyriia.shiftplanner.domain.model.AppCompany
import com.froggyriia.shiftplanner.domain.model.AppCompanyInvitePreview
import com.froggyriia.shiftplanner.domain.model.AppUser

interface CompanyRepository {
    suspend fun createCompany(name: String): AppCompany
    suspend fun fetchMyCompany(): AppCompany
    suspend fun updateMyCompany(name: String?, address: String?): AppCompany
    suspend fun regenerateInviteCode(): AppCompany
    suspend fun fetchBranches(): List<AppBranchOption>
    suspend fun createBranch(name: String, address: String?): AppBranchOption
    suspend fun updateBranch(branchId: Int, name: String?, address: String?): AppBranchOption
    suspend fun deleteBranch(branchId: Int)
    suspend fun previewInvite(code: String): AppCompanyInvitePreview
    suspend fun joinCompany(inviteCode: String, branchId: Int?, positionId: Int?): AppUser
}
