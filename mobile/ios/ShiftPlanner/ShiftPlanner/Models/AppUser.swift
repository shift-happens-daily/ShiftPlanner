import Foundation

struct AppUser: Identifiable, Codable {
    let id: String
    let email: String
    let name: String
    let role: UserRole
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
