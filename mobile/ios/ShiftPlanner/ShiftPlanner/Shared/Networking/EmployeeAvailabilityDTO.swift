import Foundation

enum EmployeeAvailabilityStatusDTO: String, Codable {
    case available
    case ifNeeded = "if_needed"
    case unavailable
}

struct EmployeeAvailabilityBlockDTO: Codable {
    let weekday: Int
    let startTime: String
    let endTime: String
    let availabilityStatus: EmployeeAvailabilityStatusDTO?

    enum CodingKeys: String, CodingKey {
        case weekday
        case startTime = "start_time"
        case endTime = "end_time"
        case availabilityStatus = "availability_status"
    }
}

struct EmployeeAvailabilityResponseDTO: Codable {
    let employeeId: Int
    let weeklyAvailability: [EmployeeAvailabilityBlockDTO]
    let desiredDaysOff: [Int]

    enum CodingKeys: String, CodingKey {
        case employeeId = "employee_id"
        case weeklyAvailability = "weekly_availability"
        case desiredDaysOff = "desired_days_off"
    }
}

struct EmployeeAvailabilityUpsertDTO: Codable {
    let weeklyAvailability: [EmployeeAvailabilityBlockDTO]
    let desiredDaysOff: [Int]

    enum CodingKeys: String, CodingKey {
        case weeklyAvailability = "weekly_availability"
        case desiredDaysOff = "desired_days_off"
    }
}
