import Foundation

// MARK: - Domain models

struct EmployeeReport: Identifiable, Equatable {
    let employeeId: Int
    let fullName: String
    let position: String
    let totalHours: Double
    let totalShifts: Int

    var id: Int { employeeId }
}

struct MySelfReport: Equatable {
    let employeeId: Int
    let fullName: String
    let totalHours: Double
    let totalShifts: Int
}

// MARK: - DTOs

struct EmployeeReportResponseDTO: Codable {
    let employeeId: Int
    let fullName: String
    let position: String
    let totalHours: Double
    let totalShifts: Int

    enum CodingKeys: String, CodingKey {
        case employeeId = "employee_id"
        case fullName = "full_name"
        case position
        case totalHours = "total_hours"
        case totalShifts = "total_shifts"
    }
}

struct MySelfReportResponseDTO: Codable {
    let employeeId: Int
    let fullName: String
    let totalHours: Double
    let totalShifts: Int

    enum CodingKeys: String, CodingKey {
        case employeeId = "employee_id"
        case fullName = "full_name"
        case totalHours = "total_hours"
        case totalShifts = "total_shifts"
    }
}
