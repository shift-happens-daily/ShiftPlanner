import Foundation

protocol CompanyRepository {
    func createCompany(name: String) async throws -> AppCompany
    func fetchMyCompany() async throws -> AppCompany
    func updateMyCompany(name: String?, address: String?) async throws -> AppCompany
    func regenerateInviteCode() async throws -> AppCompany
    func fetchBranches() async throws -> [AppBranchOption]
    func createBranch(name: String, address: String?) async throws -> AppBranchOption
    func updateBranch(branchId: Int, name: String?, address: String?) async throws -> AppBranchOption
    func deleteBranch(branchId: Int) async throws
    func previewInvite(code: String) async throws -> AppCompanyInvitePreview
    func joinCompany(inviteCode: String, branchId: Int?, positionId: Int?) async throws -> AppUser
}
