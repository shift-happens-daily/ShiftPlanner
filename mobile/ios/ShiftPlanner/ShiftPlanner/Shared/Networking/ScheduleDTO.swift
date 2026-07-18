import Foundation

// MARK: - Requests

struct ScheduleGenerateRequestDTO: Codable {
    let startDate: String
    let endDate: String
    let branchId: Int?

    enum CodingKeys: String, CodingKey {
        case startDate = "start_date"
        case endDate = "end_date"
        case branchId = "branch_id"
    }
}

struct RequirementAssignRequestDTO: Codable {
    let employeeId: Int

    enum CodingKeys: String, CodingKey {
        case employeeId = "employee_id"
    }
}

struct ManualShiftCreateRequestDTO: Codable {
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
}

struct ScheduleShiftUpdateRequestDTO: Codable {
    let date: String
    let startTime: String
    let endTime: String
    let positionId: Int
    let employeeId: Int?
    let action: String?

    enum CodingKeys: String, CodingKey {
        case date
        case startTime = "start_time"
        case endTime = "end_time"
        case positionId = "position_id"
        case employeeId = "employee_id"
        case action
    }
}

struct ScheduleRequirementInScheduleUpdateDTO: Codable {
    let branchId: Int?
    let positionId: Int
    let date: String
    let minStaff: Int
    let requiredCount: Int
    let startTime: String
    let endTime: String

    enum CodingKeys: String, CodingKey {
        case branchId = "branch_id"
        case positionId = "position_id"
        case date
        case minStaff = "min_staff"
        case requiredCount = "required_count"
        case startTime = "start_time"
        case endTime = "end_time"
    }
}

// MARK: - Responses

struct ScheduleResponseDTO: Codable {
    let id: Int
    let branchId: Int?
    // Period covered by this schedule (ScheduleRead). Optional for resilience
    // against older deployments that might omit them.
    let startDate: String?
    let endDate: String?
    let status: String
    let shifts: [ScheduleShiftResponseDTO]
    let unfilledRequirements: [ScheduleUnfilledRequirementResponseDTO]

    enum CodingKeys: String, CodingKey {
        case id
        case branchId = "branch_id"
        case startDate = "start_date"
        case endDate = "end_date"
        case status
        case shifts
        case unfilledRequirements = "unfilled_requirements"
    }
}

/// Item of GET /schedule — used to detect schedules that overlap a period.
struct ScheduleListItemResponseDTO: Codable {
    let id: Int
    let branchId: Int?
    let startDate: String
    let endDate: String
    let status: String

    enum CodingKeys: String, CodingKey {
        case id
        case branchId = "branch_id"
        case startDate = "start_date"
        case endDate = "end_date"
        case status
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

struct AvailableEmployeePositionDTO: Codable {
    let id: Int
    let name: String
}

struct AvailableEmployeeBranchDTO: Codable {
    let id: Int
    let name: String
}

struct AvailableEmployeeResponseDTO: Codable {
    let id: Int
    let fullName: String
    let position: AvailableEmployeePositionDTO
    let branch: AvailableEmployeeBranchDTO?
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

// MARK: - Employee calendar summary (shifts across ALL published schedules)

struct EmployeeCalendarPositionDTO: Codable {
    let id: Int
    let name: String
}

struct EmployeeCalendarEmployeeDTO: Codable {
    let id: Int
    let fullName: String
    let position: EmployeeCalendarPositionDTO?

    enum CodingKeys: String, CodingKey {
        case id
        case fullName = "full_name"
        case position
    }
}

struct EmployeeCalendarShiftDTO: Codable {
    let shiftId: Int
    let scheduleId: Int
    let date: String
    let startTime: String
    let endTime: String
    let status: String?

    enum CodingKeys: String, CodingKey {
        case shiftId = "shift_id"
        case scheduleId = "schedule_id"
        case date
        case startTime = "start_time"
        case endTime = "end_time"
        case status
    }
}

struct EmployeeCalendarSummaryDTO: Codable {
    let employee: EmployeeCalendarEmployeeDTO
    let shifts: [EmployeeCalendarShiftDTO]
}

/// Wrapper that tolerates both shapes of POST /schedule/generate:
/// the deployed backend returns a single object, algorithm2 returns an array.
struct ScheduleGenerateResponseDTO: Decodable {
    let schedules: [ScheduleResponseDTO]

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let array = try? container.decode([ScheduleResponseDTO].self) {
            schedules = array
        } else if let single = try? container.decode(ScheduleResponseDTO.self) {
            schedules = [single]
        } else {
            schedules = []
        }
    }
}
