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
        let body = try JSONEncoder().encode(CompanyUpdateRequest(name: name, address: address))
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
        let body = try JSONEncoder().encode(CompanyBranchCreateRequest(name: name, address: address))
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
        let body = try JSONEncoder().encode(CompanyBranchUpdateRequest(name: name, address: address))
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

    func fetchBranchWorkingHours(companyId: Int, branchId: Int) async throws -> [Int: DayWorkingHours] {
        let request = apiClient.makeRequest(
            path: "companies/\(companyId)/branches/\(branchId)/working-hours",
            method: "GET",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: [String: WorkingHoursRangeDTO].self)
        return Self.mapWorkingHours(response)
    }

    func updateBranchWorkingHours(companyId: Int, branchId: Int, hours: [Int: DayWorkingHours]) async throws -> [Int: DayWorkingHours] {
        var payload: [String: WorkingHoursRangeDTO] = [:]
        for (weekday, range) in hours {
            payload[String(weekday)] = WorkingHoursRangeDTO(startSlot: range.startSlot, endSlot: range.endSlot)
        }
        let body = try JSONEncoder().encode(payload)
        let request = apiClient.makeRequest(
            path: "companies/\(companyId)/branches/\(branchId)/working-hours",
            method: "PATCH",
            body: body,
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: [String: WorkingHoursRangeDTO].self)
        return Self.mapWorkingHours(response)
    }

    private static func mapWorkingHours(_ response: [String: WorkingHoursRangeDTO]) -> [Int: DayWorkingHours] {
        var mapped: [Int: DayWorkingHours] = [:]
        for (key, range) in response {
            guard let weekday = Int(key) else { continue }
            mapped[weekday] = DayWorkingHours(startSlot: range.startSlot, endSlot: range.endSlot)
        }
        return mapped
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

    func joinCompany(inviteCode: String) async throws -> AppUser {
        let body = try JSONEncoder().encode(
            CompanyJoinRequest(
                inviteCode: inviteCode,
                branchId: nil,
                positionId: nil
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
