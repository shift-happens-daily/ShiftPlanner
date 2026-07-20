import Foundation

struct CompanyCreateRequest: Codable {
    let name: String
}

struct CompanyUpdateRequest: Codable {
    let name: String?
    let address: String?
}

struct CompanyResponse: Codable {
    let id: Int
    let name: String
    let address: String?
    let inviteCode: String

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case address
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
    let address: String?
}

struct PositionOptionResponse: Codable {
    let id: Int
    let name: String
}

// MARK: - Branch management

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

struct CompanyBranchCreateRequest: Codable {
    let name: String
    let address: String?
}

struct CompanyBranchUpdateRequest: Codable {
    let name: String?
    let address: String?
}

/// Value of the working-hours map: weekday key "0".."6" (Mon..Sun) → range in 30-min slots.
struct WorkingHoursRangeDTO: Codable {
    let startSlot: Int
    let endSlot: Int

    enum CodingKeys: String, CodingKey {
        case startSlot = "start_slot"
        case endSlot = "end_slot"
    }
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

struct CompanyJoinManagerRequest: Codable {
    let inviteCode: String

    enum CodingKeys: String, CodingKey {
        case inviteCode = "invite_code"
    }
}

extension CompanyResponse {
    func asAppCompany() -> AppCompany {
        AppCompany(id: id, name: name, inviteCode: inviteCode, address: address)
    }
}

extension CompanyBranchResponse {
    func asAppBranchOption() -> AppBranchOption {
        AppBranchOption(id: id, name: name, address: address)
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
