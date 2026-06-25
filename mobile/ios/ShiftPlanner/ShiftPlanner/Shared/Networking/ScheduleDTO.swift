import Foundation

struct ScheduleGenerateRequestDTO: Codable {
    let startDate: String
    let endDate: String

    enum CodingKeys: String, CodingKey {
        case startDate = "start_date"
        case endDate = "end_date"
    }
}

struct ScheduleShiftUpdateRequestDTO: Codable {
    let action: String
    let employeeId: Int?

    enum CodingKeys: String, CodingKey {
        case action
        case employeeId = "employee_id"
    }
}

struct ScheduleResponseDTO: Codable {
    let id: Int
    let status: String
    let shifts: [ScheduleShiftResponseDTO]
    let unfilledRequirements: [ScheduleUnfilledRequirementResponseDTO]

    enum CodingKeys: String, CodingKey {
        case id
        case status
        case shifts
        case unfilledRequirements = "unfilled_requirements"
    }
}

struct ScheduleShiftResponseDTO: Codable {
    let id: Int
    let employeeId: Int
    let employeeName: String
    let positionId: Int
    let position: String
    let date: String
    let startTime: String
    let endTime: String

    enum CodingKeys: String, CodingKey {
        case id
        case employeeId = "employee_id"
        case employeeName = "employee_name"
        case positionId = "position_id"
        case position
        case date
        case startTime = "start_time"
        case endTime = "end_time"
    }
}

struct ScheduleUnfilledRequirementResponseDTO: Codable {
    let requirementId: Int
    let positionId: Int
    let positionTitle: String
    let date: String
    let startTime: String
    let endTime: String
    let missingStaff: Int

    enum CodingKeys: String, CodingKey {
        case requirementId = "requirement_id"
        case positionId = "position_id"
        case positionTitle = "position_title"
        case date
        case startTime = "start_time"
        case endTime = "end_time"
        case missingStaff = "missing_staff"
    }
}
