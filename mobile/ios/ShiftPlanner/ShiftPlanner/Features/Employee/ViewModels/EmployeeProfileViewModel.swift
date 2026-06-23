import Combine
import Foundation

@MainActor
final class EmployeeProfileViewModel: ObservableObject {
    let user: AppUser

    init(user: AppUser) {
        self.user = user
    }

    var companyName: String? {
        user.company?.name
    }

    var companyAddress: String? {
        user.company?.address?.trimmedNonEmpty
    }

    var branchName: String? {
        user.branch?.name
    }

    var branchAddress: String? {
        user.branch?.address?.trimmedNonEmpty
    }

    var positionName: String? {
        user.position?.name
    }
}

private extension String {
    var trimmedNonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
