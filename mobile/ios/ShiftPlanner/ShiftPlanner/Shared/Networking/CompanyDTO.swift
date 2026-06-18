import Foundation

struct CompanyCreateRequest: Codable {
    let name: String
}

struct CompanyBranchCreateRequest: Codable {
    let name: String
}

struct CompanyResponse: Codable {
    let id: Int
    let name: String
    let inviteCode: String

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case inviteCode = "invite_code"
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
}

struct CompanyBranchResponse: Codable {
    let id: Int
    let name: String
    let companyId: Int

    enum CodingKeys: String, CodingKey {
        case id
        case name
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
        AppCompany(id: id, name: name, inviteCode: inviteCode, branches: [])
    }
}

extension CompanyInvitePreviewResponse {
    func asAppCompanyInvitePreview() -> AppCompanyInvitePreview {
        AppCompanyInvitePreview(
            id: companyId,
            name: companyName,
            inviteCode: inviteCode,
            branches: branches.map { AppBranchOption(id: $0.id, name: $0.name) },
            positions: positions.map { AppPositionOption(id: $0.id, name: $0.name) }
        )
    }
}

extension CompanyBranchResponse {
    func asAppBranchOption() -> AppBranchOption {
        AppBranchOption(id: id, name: name)
    }
}
