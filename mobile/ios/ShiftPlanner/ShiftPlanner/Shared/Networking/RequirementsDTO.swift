import Foundation

struct ScheduleRequirementResponseDTO: Codable {
    let id: Int
    let branchId: Int?
    let positionId: Int
    let positionTitle: String
    let date: String
    let minStaff: Int
    let startTime: String
    let endTime: String

    enum CodingKeys: String, CodingKey {
        case id
        case branchId = "branch_id"
        case positionId = "position_id"
        case positionTitle = "position_title"
        case date
        case minStaff = "min_staff"
        case startTime = "start_time"
        case endTime = "end_time"
    }
}

struct ScheduleRequirementCreateDTO: Codable {
    let positionId: Int
    let date: String
    let minStaff: Int
    let startTime: String
    let endTime: String

    enum CodingKeys: String, CodingKey {
        case positionId = "position_id"
        case date
        case minStaff = "min_staff"
        case startTime = "start_time"
        case endTime = "end_time"
    }
}

struct ScheduleRequirementUpdateDTO: Codable {
    let positionId: Int
    let date: String
    let minStaff: Int
    let startTime: String
    let endTime: String

    enum CodingKeys: String, CodingKey {
        case positionId = "position_id"
        case date
        case minStaff = "min_staff"
        case startTime = "start_time"
        case endTime = "end_time"
    }
}

struct ScheduleRequirementTemplateCreateDTO: Codable {
    let positionId: Int
    let minStaff: Int
    let startTime: String
    let endTime: String

    enum CodingKeys: String, CodingKey {
        case positionId = "position_id"
        case minStaff = "min_staff"
        case startTime = "start_time"
        case endTime = "end_time"
    }
}

struct ScheduleRequirementBulkCreateDTO: Codable {
    let startDate: String
    let endDate: String
    let weekdays: [Int]
    let requirements: [ScheduleRequirementTemplateCreateDTO]

    enum CodingKeys: String, CodingKey {
        case startDate = "start_date"
        case endDate = "end_date"
        case weekdays
        case requirements
    }
}

struct ScheduleRequirementBulkResponseDTO: Codable {
    let createdCount: Int
    let requirements: [ScheduleRequirementResponseDTO]

    enum CodingKeys: String, CodingKey {
        case createdCount = "created_count"
        case requirements
    }
}

struct PositionResponseDTO: Codable {
    let id: Int
    let title: String
    let companyId: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case companyId = "company_id"
    }
}

struct RequirementsImportResultDTO: Decodable {
    let createdCount: Int
    let errors: [ImportRowErrorDTO]

    enum CodingKeys: String, CodingKey {
        case createdCount = "created_count"
        case errors
    }
}

struct ImportRowErrorDTO: Decodable {
    let row: Int
    let message: String
}
