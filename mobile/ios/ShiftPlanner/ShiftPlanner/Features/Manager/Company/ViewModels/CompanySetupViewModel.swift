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
            errorMessage = "Company name is required."
            return
        }

        isSaving = true
        errorMessage = nil

        do {
            createdCompany = try await repository.createCompany(name: trimmedName)
        } catch {
            errorMessage = error.localizedDescription
        }

        isSaving = false
    }
}
