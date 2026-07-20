import Combine
import Foundation

@MainActor
final class EmployeeProfileViewModel: ObservableObject {
    let user: AppUser

    init(user: AppUser) {
        self.user = user
    }

    var companyName: String? {
        guard let name = user.company?.name else { return nil }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    // Branch, position and company address are not part of the current
    // `auth/me` payload (AppUser only carries id/email/name/role/employeeId
    // and a company summary), so they are unavailable here for now. Kept as
    // nil-returning properties so a future profile screen can bind to them
    // once the backend/user model exposes that data.
    var companyAddress: String? { nil }
    var branchName: String? { nil }
    var branchAddress: String? { nil }
    var positionName: String? { nil }
}
