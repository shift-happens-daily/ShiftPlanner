import Foundation

enum AppAbsenceType: String, Codable, CaseIterable, Identifiable {
    case vacation
    case sickLeave = "sick_leave"
    case other

    var id: String { rawValue }

    var title: String {
        switch self {
        case .vacation:
            return localized("Vacation", "Отпуск")
        case .sickLeave:
            return localized("Sick leave", "Больничный")
        case .other:
            return localized("Other", "Другое")
        }
    }

    static func fromApiValue(_ value: String?) -> AppAbsenceType {
        guard let value else { return .other }
        return AppAbsenceType(rawValue: value) ?? .other
    }
}

enum AppAbsenceStatus: String, Codable {
    case pending
    case approved
    case rejected

    var title: String {
        switch self {
        case .pending:
            return localized("Pending", "На рассмотрении")
        case .approved:
            return localized("Approved", "Одобрено")
        case .rejected:
            return localized("Rejected", "Отклонено")
        }
    }

    /// nil when the backend omits status (no approval workflow) or sends
    /// an unknown value — mirrors the Android tolerance fix.
    static func fromApiValue(_ value: String?) -> AppAbsenceStatus? {
        guard let value else { return nil }
        return AppAbsenceStatus(rawValue: value)
    }
}

struct AppAbsence: Identifiable, Equatable {
    let id: Int
    let absenceType: AppAbsenceType
    let startDate: String
    let endDate: String
    let comment: String?
    let status: AppAbsenceStatus?
    let employeeId: Int
}
