import Foundation
import Combine

@MainActor
final class CompanyDetailsViewModel: ObservableObject {
    @Published private(set) var branches: [AppBranchOption] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let repository: CompanyRepository
    private var lastLoadedCompanyId: Int?

    init(repository: CompanyRepository? = nil) {
        self.repository = repository ?? APICompanyRepository()
    }

    func loadBranches(for companyId: Int) async {
        guard lastLoadedCompanyId != companyId || branches.isEmpty else { return }

        isLoading = true
        errorMessage = nil

        do {
            branches = try await repository.fetchBranches(companyId: companyId)
            lastLoadedCompanyId = companyId
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func reset() {
        branches = []
        errorMessage = nil
        lastLoadedCompanyId = nil
    }
}
