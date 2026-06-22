import Foundation
import Combine

@MainActor
final class CompanyDetailsViewModel: ObservableObject {
    @Published private(set) var company: AppCompany?
    @Published private(set) var branches: [AppBranchOption] = []
    @Published var branchDrafts: [CompanyBranchDraft] = []
    @Published var companyName = ""
    @Published var companyAddress = ""
    @Published var isEditing = false
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var isRegeneratingInviteCode = false
    @Published var errorMessage: String?

    private let repository: CompanyRepository
    private var hasLoadedCompany = false

    init(repository: CompanyRepository? = nil) {
        self.repository = repository ?? APICompanyRepository()
    }

    var shouldShowCompanyAddressField: Bool {
        branchDrafts.isEmpty
    }

    var canSaveCompany: Bool {
        !companyName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSaving
    }

    var isReadyForEditing: Bool {
        company != nil && !isLoading
    }

    func loadCompany(forceRefresh: Bool = false) async {
        guard !hasLoadedCompany || forceRefresh else { return }

        isLoading = true
        errorMessage = nil

        do {
            async let companyRequest = repository.fetchMyCompany()
            async let branchesRequest = repository.fetchBranches()

            let loadedCompany = try await companyRequest
            let loadedBranches = try await branchesRequest
            let completeCompany = loadedCompany.withBranches(loadedBranches)

            company = completeCompany
            branches = loadedBranches
            configureForm(with: completeCompany)
            hasLoadedCompany = true
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func configureForm(with company: AppCompany) {
        guard !isEditing else { return }

        self.company = company
        companyName = company.name
        companyAddress = company.address ?? ""
        branchDrafts = company.branches.map {
            CompanyBranchDraft(
                remoteID: $0.id,
                name: $0.name,
                address: $0.address ?? ""
            )
        }
    }

    func startEditing(with company: AppCompany) {
        self.company = company
        companyName = company.name
        companyAddress = company.address ?? ""
        branchDrafts = company.branches.map {
            CompanyBranchDraft(
                remoteID: $0.id,
                name: $0.name,
                address: $0.address ?? ""
            )
        }
        errorMessage = nil
        isEditing = true
    }

    func cancelEditing(with company: AppCompany) {
        configureForm(with: company)
        errorMessage = nil
        isEditing = false
    }

    func addBranchDraft() {
        branchDrafts.append(CompanyBranchDraft())
    }

    func removeBranchDraft(id: UUID) {
        branchDrafts.removeAll { $0.id == id }
    }

    func regenerateInviteCode() async -> AppCompany? {
        guard let currentCompany = company else { return nil }

        isRegeneratingInviteCode = true
        errorMessage = nil

        do {
            let regeneratedCompany = try await repository.regenerateInviteCode()
            let updatedCompany = regeneratedCompany.withBranches(branches)
            company = updatedCompany
            configureForm(with: updatedCompany)
            isRegeneratingInviteCode = false
            return updatedCompany
        } catch {
            errorMessage = error.localizedDescription
            isRegeneratingInviteCode = false
            company = currentCompany
            return nil
        }
    }

    func saveCompanyChanges(for fallbackCompany: AppCompany) async -> AppCompany? {
        let trimmedName = companyName.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedAddress = companyAddress.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedName.isEmpty else {
            errorMessage = localized("Company name is required.", "Введите название компании.")
            return nil
        }

        if let validationError = validateBranchDrafts() {
            errorMessage = validationError
            return nil
        }

        isSaving = true
        errorMessage = nil

        do {
            let shouldUseCompanyAddress = branchDrafts.isEmpty
            var updatedCompany = try await repository.updateMyCompany(
                name: trimmedName,
                address: shouldUseCompanyAddress ? (trimmedAddress.isEmpty ? nil : trimmedAddress) : nil
            )

            let existingBranchIDs = Set(branches.map(\.id))
            let keptBranchIDs = Set(branchDrafts.compactMap(\.remoteID))
            let branchIDsToDelete = existingBranchIDs.subtracting(keptBranchIDs)

            for branchID in branchIDsToDelete {
                try await repository.deleteBranch(branchId: branchID)
            }

            var savedBranches: [AppBranchOption] = []
            for draft in branchDrafts {
                let branchName = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
                let branchAddress = draft.address.trimmingCharacters(in: .whitespacesAndNewlines)
                let normalizedAddress = branchAddress.isEmpty ? nil : branchAddress

                if let remoteID = draft.remoteID {
                    let updatedBranch = try await repository.updateBranch(
                        branchId: remoteID,
                        name: branchName,
                        address: normalizedAddress
                    )
                    savedBranches.append(updatedBranch)
                } else if !branchName.isEmpty {
                    let createdBranch = try await repository.createBranch(
                        name: branchName,
                        address: normalizedAddress
                    )
                    savedBranches.append(createdBranch)
                }
            }

            updatedCompany = updatedCompany.withBranches(savedBranches)
            company = updatedCompany
            branches = savedBranches
            companyName = updatedCompany.name
            companyAddress = updatedCompany.address ?? ""
            branchDrafts = savedBranches.map {
                CompanyBranchDraft(
                    remoteID: $0.id,
                    name: $0.name,
                    address: $0.address ?? ""
                )
            }
            isEditing = false
            isSaving = false
            hasLoadedCompany = true
            return updatedCompany
        } catch {
            errorMessage = error.localizedDescription
            isSaving = false
            company = company ?? fallbackCompany
            return nil
        }
    }

    func reset() {
        company = nil
        branches = []
        branchDrafts = []
        companyName = ""
        companyAddress = ""
        isEditing = false
        isSaving = false
        isRegeneratingInviteCode = false
        errorMessage = nil
        hasLoadedCompany = false
    }

    private func validateBranchDrafts() -> String? {
        for draft in branchDrafts {
            if draft.remoteID != nil || !draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                if draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    return localized("Branch name is required.", "Введите название филиала.")
                }
            }
        }

        return nil
    }
}
