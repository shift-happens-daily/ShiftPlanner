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

struct AppScheduledShift: Identifiable, Equatable {
    let id: Int
    let employeeId: Int
    let employeeName: String
    let positionId: Int
    let positionName: String
    let date: Date
    let startMinutes: Int
    let endMinutes: Int
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

struct AppSchedule: Identifiable, Equatable {
    let id: Int
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
}
