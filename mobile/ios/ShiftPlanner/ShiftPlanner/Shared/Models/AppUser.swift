import Foundation

struct AppUser: Identifiable, Codable {
    let id: String
    /// 16-character public identifier managers use to link this user
    /// into a company. Empty/nil on older backend deployments.
    let publicId: String?
    let email: String
    let name: String
    let role: UserRole
    let employeeId: Int?
    let company: AppCompanySummary?
    /// "pending" | "active" | nil — a manager who requested to join a company
    /// stays "pending" until an existing manager approves the request.
    let managerStatus: String?

    init(
        id: String,
        publicId: String? = nil,
        email: String,
        name: String,
        role: UserRole,
        employeeId: Int?,
        company: AppCompanySummary?,
        managerStatus: String? = nil
    ) {
        self.id = id
        self.publicId = publicId
        self.email = email
        self.name = name
        self.role = role
        self.employeeId = employeeId
        self.company = company
        self.managerStatus = managerStatus
    }

    var hasCompany: Bool {
        company != nil
    }

    /// A manager who requested to join a company and is awaiting approval.
    var isManagerPending: Bool {
        role == .manager && company == nil && managerStatus == "pending"
    }

    /// Public ID when present, otherwise the numeric id — mirrors Android's
    /// `publicId.ifEmpty { id }` used on the profile screen.
    var displayId: String {
        if let publicId, !publicId.isEmpty {
            return publicId
        }
        return id
    }

    /// Returns a copy of the user attached to [company] (as a summary).
    func withCompany(_ company: AppCompany) -> AppUser {
        AppUser(
            id: id,
            publicId: publicId,
            email: email,
            name: name,
            role: role,
            employeeId: employeeId,
            company: AppCompanySummary(
                id: company.id,
                name: company.name,
                inviteCode: company.inviteCode
            )
        )
    }
}

enum UserRole: String, Codable, CaseIterable, Identifiable {
    case manager
    case employee

    var id: String { rawValue }

    var title: String {
        switch self {
        case .manager: return "Manager"
        case .employee: return "Employee"
        }
    }
}
