import Foundation

final class APICompanyRepository: CompanyRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func createCompany(name: String) async throws -> AppCompany {
        let body = try JSONEncoder().encode(CompanyCreateRequest(name: name))
        let request = apiClient.makeRequest(
            path: "companies/",
            method: "POST",
            body: body,
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: CompanyResponse.self)
        return response.asAppCompany()
    }

    func fetchMyCompany() async throws -> AppCompany {
        let request = apiClient.makeRequest(
            path: "companies/me",
            method: "GET",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: CompanyResponse.self)
        return response.asAppCompany()
    }

    func updateMyCompany(name: String?, address: String?) async throws -> AppCompany {
        let body = try JSONEncoder().encode(
            CompanyUpdateRequest(
                name: name,
                address: address
            )
        )
        let request = apiClient.makeRequest(
            path: "companies/me",
            method: "PATCH",
            body: body,
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: CompanyResponse.self)
        return response.asAppCompany()
    }

    func regenerateInviteCode() async throws -> AppCompany {
        let request = apiClient.makeRequest(
            path: "companies/me/invite-code/regenerate",
            method: "POST",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: CompanyResponse.self)
        return response.asAppCompany()
    }

    func fetchBranches() async throws -> [AppBranchOption] {
        let request = apiClient.makeRequest(
            path: "companies/branches",
            method: "GET",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: [CompanyBranchResponse].self)
        return response.map { $0.asAppBranchOption() }
    }

    func createBranch(name: String, address: String?) async throws -> AppBranchOption {
        let body = try JSONEncoder().encode(
            CompanyBranchCreateRequest(
                name: name,
                address: address
            )
        )
        let request = apiClient.makeRequest(
            path: "companies/branches",
            method: "POST",
            body: body,
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: CompanyBranchResponse.self)
        return response.asAppBranchOption()
    }

    func updateBranch(branchId: Int, name: String?, address: String?) async throws -> AppBranchOption {
        let body = try JSONEncoder().encode(
            CompanyBranchUpdateRequest(
                name: name,
                address: address
            )
        )
        let request = apiClient.makeRequest(
            path: "companies/branches/\(branchId)",
            method: "PATCH",
            body: body,
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: CompanyBranchResponse.self)
        return response.asAppBranchOption()
    }

    func deleteBranch(branchId: Int) async throws {
        let request = apiClient.makeRequest(
            path: "companies/branches/\(branchId)",
            method: "DELETE",
            requiresAuthorization: true
        )
        try await apiClient.sendWithoutResponseBody(request)
    }

    func previewInvite(code: String) async throws -> AppCompanyInvitePreview {
        let request = apiClient.makeRequest(
            path: "companies/invite/\(code)",
            method: "GET",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: CompanyInvitePreviewResponse.self)
        return response.asAppCompanyInvitePreview()
    }

    func joinCompany(inviteCode: String, branchId: Int?, positionId: Int?) async throws -> AppUser {
        let body = try JSONEncoder().encode(
            CompanyJoinRequest(
                inviteCode: inviteCode,
                branchId: branchId,
                positionId: positionId
            )
        )
        let request = apiClient.makeRequest(
            path: "companies/join",
            method: "POST",
            body: body,
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: CurrentUserResponse.self)
        return response.asAppUser()
    }
}
