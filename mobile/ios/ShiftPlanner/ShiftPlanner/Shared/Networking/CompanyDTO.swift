import Foundation

struct CompanyCreateRequest: Codable {
    let name: String
}

struct CompanyUpdateRequest: Codable {
    let name: String?
    let address: String?
}

struct CompanyBranchCreateRequest: Codable {
    let name: String
    let address: String?
}

struct CompanyBranchUpdateRequest: Codable {
    let name: String?
    let address: String?
}

struct CompanyResponse: Codable {
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

struct CompanyInvitePreviewResponse: Codable {
    let companyId: Int
    let companyName: String
    let inviteCode: String
    let branches: [BranchOptionResponse]
    let positions: [PositionOptionResponse]

    enum CodingKeys: String, CodingKey {
        case companyId = "company_id"
        case companyName = "company_name"
        case inviteCode = "invite_code"
        case branches
        case positions
    }
}

struct BranchOptionResponse: Codable {
    let id: Int
    let name: String
    let address: String?
}

struct CompanyBranchResponse: Codable {
    let id: Int
    let name: String
    let address: String?
    let companyId: Int

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case address
        case companyId = "company_id"
    }
}

struct PositionOptionResponse: Codable {
    let id: Int
    let name: String
}

struct CompanyJoinRequest: Codable {
    let inviteCode: String
    let branchId: Int?
    let positionId: Int?

    enum CodingKeys: String, CodingKey {
        case inviteCode = "invite_code"
        case branchId = "branch_id"
        case positionId = "position_id"
    }
}

extension CompanyResponse {
    func asAppCompany() -> AppCompany {
        AppCompany(
            id: id,
            name: name,
            address: address,
            inviteCode: inviteCode,
            inviteCodeGeneratedAt: inviteCodeGeneratedAt,
            inviteCodeExpiresAt: inviteCodeExpiresAt,
            branches: []
        )
    }
}

extension CompanyInvitePreviewResponse {
    func asAppCompanyInvitePreview() -> AppCompanyInvitePreview {
        AppCompanyInvitePreview(
            id: companyId,
            name: companyName,
            inviteCode: inviteCode,
            branches: branches.map { AppBranchOption(id: $0.id, name: $0.name, address: $0.address) },
            positions: positions.map { AppPositionOption(id: $0.id, name: $0.name) }
        )
    }
}

extension CompanyBranchResponse {
    func asAppBranchOption() -> AppBranchOption {
        AppBranchOption(id: id, name: name, address: address)
    }
}
