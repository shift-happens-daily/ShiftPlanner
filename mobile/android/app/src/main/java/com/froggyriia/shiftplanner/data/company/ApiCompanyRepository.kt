package com.froggyriia.shiftplanner.data.company

import com.froggyriia.shiftplanner.data.network.ApiClient
import com.froggyriia.shiftplanner.data.network.CompanyBranchCreateRequestDto
import com.froggyriia.shiftplanner.data.network.CompanyBranchUpdateRequestDto
import com.froggyriia.shiftplanner.data.network.CompanyCreateRequestDto
import com.froggyriia.shiftplanner.data.network.CompanyJoinRequestDto
import com.froggyriia.shiftplanner.data.network.CompanyUpdateRequestDto
import com.froggyriia.shiftplanner.domain.model.AppBranchOption
import com.froggyriia.shiftplanner.domain.model.AppCompany
import com.froggyriia.shiftplanner.domain.model.AppCompanyInvitePreview
import com.froggyriia.shiftplanner.domain.model.AppUser

class ApiCompanyRepository(
    private val apiClient: ApiClient
) : CompanyRepository {

    override suspend fun createCompany(name: String): AppCompany = wrap {
        apiClient.api.createCompany(CompanyCreateRequestDto(name = name)).toDomain()
    }

    override suspend fun fetchMyCompany(): AppCompany = wrap {
        val company = apiClient.api.getMyCompany()
        val branches = try {
            apiClient.api.getBranches().map { it.toDomain() }
        } catch (_: Throwable) { emptyList() }
        company.toDomain(branches)
    }

    override suspend fun updateMyCompany(name: String?, address: String?): AppCompany = wrap {
        apiClient.api.updateMyCompany(
            CompanyUpdateRequestDto(name = name, address = address)
        ).toDomain()
    }

    override suspend fun regenerateInviteCode(): AppCompany = wrap {
        apiClient.api.regenerateInviteCode().toDomain()
    }

    override suspend fun fetchBranches(): List<AppBranchOption> = wrap {
        apiClient.api.getBranches().map { it.toDomain() }
    }

    override suspend fun createBranch(name: String, address: String?): AppBranchOption = wrap {
        apiClient.api.createBranch(
            CompanyBranchCreateRequestDto(name = name, address = address)
        ).toDomain()
    }

    override suspend fun updateBranch(
        branchId: Int,
        name: String?,
        address: String?
    ): AppBranchOption = wrap {
        apiClient.api.updateBranch(
            branchId = branchId,
            request = CompanyBranchUpdateRequestDto(name = name, address = address)
        ).toDomain()
    }

    override suspend fun deleteBranch(branchId: Int) = wrap {
        apiClient.api.deleteBranch(branchId)
        Unit
    }

    override suspend fun previewInvite(code: String): AppCompanyInvitePreview = wrap {
        apiClient.api.previewInvite(code).toDomain()
    }

    override suspend fun joinCompany(
        inviteCode: String,
        branchId: Int?,
        positionId: Int?
    ): AppUser = wrap {
        apiClient.api.joinCompany(
            CompanyJoinRequestDto(
                inviteCode = inviteCode,
                branchId = branchId,
                positionId = positionId
            )
        ).toAppUser()
    }

    private suspend fun <T> wrap(block: suspend () -> T): T {
        return try {
            block()
        } catch (error: Throwable) {
            throw Exception(apiClient.userMessage(error))
        }
    }
}
