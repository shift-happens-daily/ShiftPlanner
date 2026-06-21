import Foundation
import Combine

@MainActor
final class CompanySetupViewModel: ObservableObject {
    @Published var companyName = ""
    @Published var hasBranches = false
    @Published var companyAddress = ""
    @Published var allowsRotationBetweenBranches = false
    @Published var branches: [CompanyBranchDraft] = [CompanyBranchDraft()]

    @Published var isSaving = false
    @Published var errorMessage: String?
    @Published var createdCompany: AppCompany?

    private let repository: CompanyRepository

    init(repository: CompanyRepository) {
        self.repository = repository
    }

    var canCreateCompany: Bool {
        !companyName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    func addBranch() {
        branches.append(CompanyBranchDraft())
    }

    func removeBranch(id: UUID) {
        branches.removeAll { $0.id == id }
        if branches.isEmpty {
            branches = [CompanyBranchDraft()]
        }
    }

    func createCompany() async {
        let trimmedName = companyName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            errorMessage = localized("Company name is required.", "Введите название компании.")
            return
        }

        let normalizedBranchNames = branches
            .map { $0.name.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        if hasBranches && normalizedBranchNames.isEmpty {
            errorMessage = localized("Add at least one branch.", "Добавьте хотя бы один филиал.")
            return
        }

        isSaving = true
        errorMessage = nil

        do {
            let normalizedAddress = companyAddress.trimmingCharacters(in: .whitespacesAndNewlines)
            var company = try await repository.createCompany(name: trimmedName)

            if !normalizedAddress.isEmpty {
                company = try await repository.updateMyCompany(
                    name: trimmedName,
                    address: normalizedAddress
                )
            }

            if hasBranches {
                var createdBranches: [AppBranchOption] = []

                for branchName in normalizedBranchNames {
                    let createdBranch = try await repository.createBranch(
                        companyId: company.id,
                        name: branchName
                    )
                    createdBranches.append(createdBranch)
                }

                createdCompany = company.withBranches(createdBranches)
            } else {
                createdCompany = company
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isSaving = false
    }
}
