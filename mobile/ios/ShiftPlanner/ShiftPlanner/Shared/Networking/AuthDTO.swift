import Foundation

struct APIErrorResponse: Codable {
    let detail: String?
}

struct APIValidationErrorResponse: Codable {
    let detail: [APIValidationErrorItem]
}

struct APIValidationErrorItem: Codable {
    let loc: [String]?
    let msg: String
}

struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct LoginResponse: Codable {
    let accessToken: String
    let tokenType: String
    let role: UserRole

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case tokenType = "token_type"
        case role
    }
}

struct RegisterRequest: Codable {
    let fullName: String
    let email: String
    let password: String
    let role: UserRole

    enum CodingKeys: String, CodingKey {
        case fullName = "full_name"
        case email
        case password
        case role
    }
}

struct RegisterResponse: Codable {
    let id: Int
    let fullName: String
    let email: String
    let role: UserRole
    let employeeId: Int?
    
    enum CodingKeys: String, CodingKey {
        case id
        case fullName = "full_name"
        case email
        case role
        case employeeId = "employee_id"
    }
}

struct CurrentUserResponse: Codable {
    let id: Int
    let fullName: String
    let email: String
    let role: UserRole
    let employeeId: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case fullName = "full_name"
        case email
        case role
        case employeeId = "employee_id"
    }
}
