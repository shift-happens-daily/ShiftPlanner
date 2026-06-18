import Foundation
import Combine

@MainActor
final class CompanyInviteViewModel: ObservableObject {
    @Published var inviteCode = ""
    @Published var preview: AppCompanyInvitePreview?
    @Published var selectedBranchId: Int?
    @Published var selectedPositionId: Int?
    @Published var joinedUser: AppUser?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let repository: CompanyRepository

    init(repository: CompanyRepository) {
        self.repository = repository
    }

    var canJoinCompany: Bool {
        !isLoading && preview != nil && selectedBranchId != nil && selectedPositionId != nil
    }

    func previewCompany() async {
        let code = normalizedInviteCode
        guard !code.isEmpty else {
            errorMessage = localized("Invite code is required.", "Введите инвайт-код.")
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let loadedPreview = try await repository.previewInvite(code: code)
            preview = loadedPreview
            selectedBranchId = loadedPreview.branches.first?.id
            selectedPositionId = loadedPreview.positions.first?.id
        } catch {
            preview = nil
            selectedBranchId = nil
            selectedPositionId = nil
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func joinCompany() async {
        let code = normalizedInviteCode
        guard !code.isEmpty else {
            errorMessage = localized("Invite code is required.", "Введите инвайт-код.")
            return
        }

        guard let branchId = selectedBranchId else {
            errorMessage = localized("Please select a branch.", "Выберите филиал.")
            return
        }

        guard let positionId = selectedPositionId else {
            errorMessage = localized("Please select a position.", "Выберите должность.")
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            joinedUser = try await repository.joinCompany(
                inviteCode: code,
                branchId: branchId,
                positionId: positionId
            )
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    private var normalizedInviteCode: String {
        inviteCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    }
}
