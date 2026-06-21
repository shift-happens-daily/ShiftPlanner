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
