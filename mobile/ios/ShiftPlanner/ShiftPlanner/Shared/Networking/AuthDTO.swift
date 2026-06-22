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
    let company: CurrentUserCompanyResponse?
    let branch: CurrentUserBranchResponse?
    let position: CurrentUserPositionResponse?

    enum CodingKeys: String, CodingKey {
        case id
        case fullName = "full_name"
        case email
        case role
        case employeeId = "employee_id"
        case company
        case branch
        case position
    }
}

struct CurrentUserCompanyResponse: Codable {
    let id: Int
    let name: String
    let address: String?
    let inviteCode: String
    let inviteCodeGeneratedAt: Date?
    let inviteCodeExpiresAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case address
        case inviteCode = "invite_code"
        case inviteCodeGeneratedAt = "invite_code_generated_at"
        case inviteCodeExpiresAt = "invite_code_expires_at"
    }
}

struct CurrentUserBranchResponse: Codable {
    let id: Int
    let name: String
    let address: String?
}

struct CurrentUserPositionResponse: Codable {
    let id: Int
    let name: String
}

extension CurrentUserResponse {
    func asAppUser() -> AppUser {
        AppUser(
            id: String(id),
            email: email,
            name: fullName,
            role: role,
            employeeId: employeeId,
            company: company.map {
                AppCompanySummary(
                    id: $0.id,
                    name: $0.name,
                    address: $0.address,
                    inviteCode: $0.inviteCode,
                    inviteCodeGeneratedAt: $0.inviteCodeGeneratedAt,
                    inviteCodeExpiresAt: $0.inviteCodeExpiresAt,
                    branches: []
                )
            },
            branch: branch.map {
                AppBranchOption(id: $0.id, name: $0.name, address: $0.address)
            },
            position: position.map {
                AppPositionOption(id: $0.id, name: $0.name)
            }
        )
    }
}
