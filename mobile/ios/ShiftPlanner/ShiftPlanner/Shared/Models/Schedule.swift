import Foundation

enum AppScheduleStatus: String, Codable, Equatable {
    case draft
    case published
    case archived

    var title: String {
        switch self {
        case .draft:
            return localized("Draft", "Черновик")
        case .published:
            return localized("Published", "Опубликовано")
        case .archived:
            return localized("Archived", "Архив")
        }
    }
}

enum AppEmployeeAvailabilityStatus: String, Codable, Equatable {
    case available
    case ifNeeded = "if_needed"
    case unavailable

    /// Sort order: available first, then if-needed, then unavailable.
    var sortRank: Int {
        switch self {
        case .available: return 0
        case .ifNeeded: return 1
        case .unavailable: return 2
        }
    }

    var title: String {
        switch self {
        case .available:
            return localized("Available", "Доступен")
        case .ifNeeded:
            return localized("If needed", "При необходимости")
        case .unavailable:
            return localized("Unavailable", "Недоступен")
        }
    }

    static func fromApiValue(_ value: String) -> AppEmployeeAvailabilityStatus {
        AppEmployeeAvailabilityStatus(rawValue: value) ?? .unavailable
    }
}

struct AppScheduledShift: Identifiable, Equatable {
    let id: Int
    let employeeId: Int?
    let employeeName: String?
    let positionId: Int
    let positionName: String
    let date: Date
    let startMinutes: Int
    let endMinutes: Int

    var hasAssignedEmployee: Bool { employeeId != nil }
}

struct AppUnfilledRequirement: Identifiable, Equatable {
    let id: Int
    let positionId: Int
    let positionTitle: String
    let date: Date
    let startMinutes: Int
    let endMinutes: Int
    let missingStaff: Int
}

struct AppAvailableEmployee: Identifiable, Equatable {
    let id: Int
    let fullName: String
    let positionName: String
    let branchId: Int?
    let branchName: String?
    let availabilityStatus: AppEmployeeAvailabilityStatus
    let assignedHours: Double
}

/// Lightweight schedule descriptor from GET /schedule (list).
struct AppScheduleListItem: Identifiable, Equatable {
    let id: Int
    let branchId: Int?
    let startDate: Date
    let endDate: Date
    let status: AppScheduleStatus
}

/// Payload shared by create/update shift and requirement mutations.
struct ScheduleShiftMutation: Equatable {
    let date: Date
    let startMinutes: Int
    let endMinutes: Int
    let positionId: Int
    let employeeId: Int?
}

struct AppSchedule: Identifiable, Equatable {
    let id: Int
    let branchId: Int?
    /// Period covered by this schedule; nil when the backend didn't send it.
    let startDate: Date?
    let endDate: Date?
    let status: AppScheduleStatus
    let shifts: [AppScheduledShift]
    let unfilledRequirements: [AppUnfilledRequirement]

    var sortedShifts: [AppScheduledShift] {
        shifts.sorted {
            if $0.date == $1.date {
                if $0.startMinutes == $1.startMinutes {
                    return $0.positionName < $1.positionName
                }
                return $0.startMinutes < $1.startMinutes
            }
            return $0.date < $1.date
        }
    }

    var sortedUnfilledRequirements: [AppUnfilledRequirement] {
        unfilledRequirements.sorted {
            if $0.date == $1.date {
                if $0.startMinutes == $1.startMinutes {
                    return $0.positionTitle < $1.positionTitle
                }
                return $0.startMinutes < $1.startMinutes
            }
            return $0.date < $1.date
        }
    }

    var hasUnfilled: Bool {
        !unfilledRequirements.isEmpty || shifts.contains { !$0.hasAssignedEmployee }
    }
}
