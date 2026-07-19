import Foundation

struct ManagedPosition: Identifiable, Equatable {
    let id: Int
    var title: String

    init(id: Int, title: String) {
        self.id = id
        self.title = title
    }
}

struct ManagedBranch: Identifiable, Equatable {
    let id: Int
    var name: String

    init(id: Int, name: String) {
        self.id = id
        self.name = name
    }
}

struct ManagedEmployee: Identifiable, Equatable {
    let id: Int
    var publicId: String
    var fullName: String
    var email: String
    var role: UserRole
    var branchId: Int?
    var branchName: String?
    var positionId: Int?
    var positionTitle: String?

    init(
        id: Int,
        publicId: String = "",
        fullName: String,
        email: String,
        role: UserRole = .employee,
        branchId: Int? = nil,
        branchName: String? = nil,
        positionId: Int? = nil,
        positionTitle: String? = nil
    ) {
        self.id = id
        self.publicId = publicId
        self.fullName = fullName
        self.email = email
        self.role = role
        self.branchId = branchId
        self.branchName = branchName
        self.positionId = positionId
        self.positionTitle = positionTitle
    }
}

/// Per-employee working limits (GET/PATCH /employees/{id}/work-limits).
struct WorkLimits: Equatable {
    var maxHoursPerWeek: Int
    var maxHoursPerDay: Int

    init(maxHoursPerWeek: Int, maxHoursPerDay: Int) {
        self.maxHoursPerWeek = maxHoursPerWeek
        self.maxHoursPerDay = maxHoursPerDay
    }
}

/// A pending manager join request (companies/me/manager-requests).
struct PendingManagerRequest: Identifiable, Equatable {
    let id: Int
    let fullName: String
    let email: String
    let managerRole: String
}

/// A pending employee join request (companies/me/employee-requests).
struct PendingEmployeeRequest: Identifiable, Equatable {
    let id: Int
    let fullName: String
    let email: String
    let positionId: Int?
    let branchId: Int?
}

/// A single shift in a manager-viewed employee calendar.
struct EmployeeCalendarShiftItem: Identifiable, Equatable {
    let id: Int
    let date: Date
    let startMinutes: Int
    let endMinutes: Int
    let status: String
}

/// Aggregated calendar for one employee, seen by a manager.
struct EmployeeCalendarSummary: Equatable {
    let employeeName: String
    let totalShifts: Int
    let totalHours: Double
    let shifts: [EmployeeCalendarShiftItem]
}

/// One branch an employee is assigned to (multi-branch), with the primary flag.
struct EmployeeBranchAssignment: Identifiable, Equatable {
    let id: Int
    let name: String
    let isPrimary: Bool
}
