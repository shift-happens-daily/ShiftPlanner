import Foundation
import Combine

@MainActor
final class CompanyDetailsViewModel: ObservableObject {
    @Published private(set) var branches: [AppBranchOption] = []
    @Published var companyName = ""
    @Published var companyAddress = ""
    @Published var isEditing = false
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var errorMessage: String?

    private let repository: CompanyRepository
    private var lastLoadedCompanyId: Int?
    private var configuredCompanyId: Int?

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

    func configureForm(with company: AppCompany) {
        guard !isEditing else { return }

        companyName = company.name
        companyAddress = company.address ?? ""
        configuredCompanyId = company.id
    }

    func startEditing(with company: AppCompany) {
        companyName = company.name
        companyAddress = company.address ?? ""
        configuredCompanyId = company.id
        errorMessage = nil
        isEditing = true
    }

    func cancelEditing(with company: AppCompany) {
        companyName = company.name
        companyAddress = company.address ?? ""
        errorMessage = nil
        isEditing = false
    }

    var canSaveCompany: Bool {
        !companyName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSaving
    }

    func saveCompanyChanges(for company: AppCompany) async -> AppCompany? {
        let trimmedName = companyName.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedAddress = companyAddress.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedName.isEmpty else {
            errorMessage = localized("Company name is required.", "Введите название компании.")
            return nil
        }

        isSaving = true
        errorMessage = nil

        do {
            let updatedCompany = try await repository.updateMyCompany(
                name: trimmedName,
                address: trimmedAddress.isEmpty ? nil : trimmedAddress
            )
            companyName = updatedCompany.name
            companyAddress = updatedCompany.address ?? ""
            configuredCompanyId = updatedCompany.id
            isEditing = false
            isSaving = false
            return updatedCompany.withBranches(branches.isEmpty ? company.branches : branches)
        } catch {
            errorMessage = error.localizedDescription
            isSaving = false
            return nil
        }
    }

    func reset() {
        branches = []
        companyName = ""
        companyAddress = ""
        isEditing = false
        isSaving = false
        errorMessage = nil
        lastLoadedCompanyId = nil
        configuredCompanyId = nil
    }
}
