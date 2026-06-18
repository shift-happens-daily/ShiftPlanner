import Foundation

struct AppUser: Identifiable, Codable {
    let id: String
    let email: String
    let name: String
    let role: UserRole
    let employeeId: Int?
    let company: AppCompanySummary?

    var hasCompany: Bool {
        company != nil
    }
}

extension AppUser {
    func withCompany(_ company: AppCompany) -> AppUser {
        AppUser(
            id: id,
            email: email,
            name: name,
            role: role,
            employeeId: employeeId,
            company: company.asSummary()
        )
    }
}

enum UserRole: String, Codable, CaseIterable, Identifiable {
    case manager
    case employee
    
    var id: String { rawValue }
    
    var title: String {
        switch self {
        case .manager: return localized("Manager", "Менеджер")
        case .employee: return localized("Employee", "Сотрудник")
        }
    }
}
