import Foundation

struct AbsenceCreateRequestDTO: Codable {
    let absenceType: String
    let startDate: String
    let endDate: String
    let comment: String?

    enum CodingKeys: String, CodingKey {
        case absenceType = "absence_type"
        case startDate = "start_date"
        case endDate = "end_date"
        case comment
    }
}

struct AbsenceResponseDTO: Codable {
    let id: Int
    let absenceType: String?
    let startDate: String
    let endDate: String
    let comment: String?
    /// Optional: the deployed backend may omit status entirely
    /// (no approval workflow) — tolerate its absence.
    let status: String?
    let employeeId: Int

    enum CodingKeys: String, CodingKey {
        case id
        case absenceType = "absence_type"
        case startDate = "start_date"
        case endDate = "end_date"
        case comment
        case status
        case employeeId = "employee_id"
    }
}

extension AbsenceResponseDTO {
    func asAppAbsence() -> AppAbsence {
        AppAbsence(
            id: id,
            absenceType: AppAbsenceType.fromApiValue(absenceType),
            startDate: startDate,
            endDate: endDate,
            comment: comment,
            status: AppAbsenceStatus.fromApiValue(status),
            employeeId: employeeId
        )
    }
}
