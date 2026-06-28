import Foundation

struct ScheduleGenerateRequestDTO: Codable {
    let startDate: String
    let endDate: String

    enum CodingKeys: String, CodingKey {
        case startDate = "start_date"
        case endDate = "end_date"
    }
}

struct RequirementAssignRequestDTO: Codable {
    let employeeId: Int

    enum CodingKeys: String, CodingKey {
        case employeeId = "employee_id"
    }
}

struct ManualShiftCreateRequestDTO: Encodable {
    let date: String
    let startTime: String
    let endTime: String
    let positionId: Int
    let employeeId: Int?

    enum CodingKeys: String, CodingKey {
        case date
        case startTime = "start_time"
        case endTime = "end_time"
        case positionId = "position_id"
        case employeeId = "employee_id"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(date, forKey: .date)
        try container.encode(startTime, forKey: .startTime)
        try container.encode(endTime, forKey: .endTime)
        try container.encode(positionId, forKey: .positionId)
        try container.encodeIfPresent(employeeId, forKey: .employeeId)
    }
}

struct ScheduleShiftUpdateRequestDTO: Encodable {
    let date: String
    let startTime: String
    let endTime: String
    let positionId: Int
    let employeeId: Int?

    enum CodingKeys: String, CodingKey {
        case date
        case startTime = "start_time"
        case endTime = "end_time"
        case positionId = "position_id"
        case employeeId = "employee_id"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(date, forKey: .date)
        try container.encode(startTime, forKey: .startTime)
        try container.encode(endTime, forKey: .endTime)
        try container.encode(positionId, forKey: .positionId)
        try container.encodeIfPresent(employeeId, forKey: .employeeId)
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

struct AvailableEmployeePositionResponseDTO: Codable {
    let id: Int
    let name: String
}

struct AvailableEmployeeBranchResponseDTO: Codable {
    let id: Int
    let name: String
}

struct AvailableEmployeeResponseDTO: Codable {
    let id: Int
    let fullName: String
    let position: AvailableEmployeePositionResponseDTO
    let branch: AvailableEmployeeBranchResponseDTO?
    let availabilityStatus: String
    let assignedHours: Double

    enum CodingKeys: String, CodingKey {
        case id
        case fullName = "full_name"
        case position
        case branch
        case availabilityStatus = "availability_status"
        case assignedHours = "assigned_hours"
    }
}

struct ScheduleShiftResponseDTO: Codable {
    let id: Int
    let employeeId: Int?
    let employeeName: String?
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
