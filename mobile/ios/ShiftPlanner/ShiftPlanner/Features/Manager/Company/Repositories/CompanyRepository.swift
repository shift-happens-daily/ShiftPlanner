import Foundation

protocol CompanyRepository {
    func createCompany(name: String) async throws -> AppCompany
    func previewInvite(code: String) async throws -> AppCompanyInvitePreview
    func joinCompany(inviteCode: String) async throws -> AppUser
}
