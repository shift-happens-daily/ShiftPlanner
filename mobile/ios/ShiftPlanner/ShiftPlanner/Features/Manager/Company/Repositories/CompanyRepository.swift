import Foundation

protocol CompanyRepository {
    func createCompany(name: String) async throws -> AppCompany
    func fetchBranches(companyId: Int) async throws -> [AppBranchOption]
    func createBranch(companyId: Int, name: String) async throws -> AppBranchOption
    func previewInvite(code: String) async throws -> AppCompanyInvitePreview
    func joinCompany(inviteCode: String, branchId: Int, positionId: Int) async throws -> AppUser
}
