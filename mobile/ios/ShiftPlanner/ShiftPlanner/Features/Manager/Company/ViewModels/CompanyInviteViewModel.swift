import Foundation
import Combine

@MainActor
final class CompanyInviteViewModel: ObservableObject {
    @Published var inviteCode = ""
    @Published var preview: AppCompanyInvitePreview?
    @Published var joinedUser: AppUser?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let repository: CompanyRepository

    init(repository: CompanyRepository) {
        self.repository = repository
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
            preview = try await repository.previewInvite(code: code)
        } catch {
            preview = nil
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

        isLoading = true
        errorMessage = nil

        do {
            joinedUser = try await repository.joinCompany(inviteCode: code)
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    private var normalizedInviteCode: String {
        inviteCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    }
}
