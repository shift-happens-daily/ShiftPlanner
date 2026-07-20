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

    /// Branch working hours: weekday (0=Mon … 6=Sun) → range in 30-minute slots.
    func fetchBranchWorkingHours(companyId: Int, branchId: Int) async throws -> [Int: DayWorkingHours]
    func updateBranchWorkingHours(companyId: Int, branchId: Int, hours: [Int: DayWorkingHours]) async throws -> [Int: DayWorkingHours]

    func previewInvite(code: String) async throws -> AppCompanyInvitePreview
    func joinCompany(inviteCode: String) async throws -> AppUser
    func joinAsManager(inviteCode: String) async throws -> AppUser
}
