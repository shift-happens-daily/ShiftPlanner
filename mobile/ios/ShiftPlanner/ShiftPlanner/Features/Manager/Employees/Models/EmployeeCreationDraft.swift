import Foundation

struct EmployeeCreationDraft: Equatable, Sendable {
    var fullName = ""
    var email = ""
    var positionId: Int?
    var branchId: Int?
}
