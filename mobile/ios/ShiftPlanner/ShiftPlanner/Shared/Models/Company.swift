import Foundation

struct AppCompanySummary: Identifiable, Codable, Equatable {
    let id: Int
    let name: String
    let address: String?
    let inviteCode: String
    let inviteCodeGeneratedAt: Date?
    let inviteCodeExpiresAt: Date?
    let branches: [AppBranchOption]

    init(
        id: Int,
        name: String,
        address: String?,
        inviteCode: String,
        inviteCodeGeneratedAt: Date? = nil,
        inviteCodeExpiresAt: Date? = nil,
        branches: [AppBranchOption]
    ) {
        self.id = id
        self.name = name
        self.address = address
        self.inviteCode = inviteCode
        self.inviteCodeGeneratedAt = inviteCodeGeneratedAt
        self.inviteCodeExpiresAt = inviteCodeExpiresAt
        self.branches = branches
    }
}

struct AppCompany: Identifiable, Codable, Equatable {
    let id: Int
    let name: String
    let address: String?
    let inviteCode: String
    let inviteCodeGeneratedAt: Date?
    let inviteCodeExpiresAt: Date?
    let branches: [AppBranchOption]

    init(
        id: Int,
        name: String,
        address: String?,
        inviteCode: String,
        inviteCodeGeneratedAt: Date? = nil,
        inviteCodeExpiresAt: Date? = nil,
        branches: [AppBranchOption]
    ) {
        self.id = id
        self.name = name
        self.address = address
        self.inviteCode = inviteCode
        self.inviteCodeGeneratedAt = inviteCodeGeneratedAt
        self.inviteCodeExpiresAt = inviteCodeExpiresAt
        self.branches = branches
    }
}

struct AppBranchOption: Identifiable, Codable, Equatable {
    let id: Int
    let name: String
    let address: String?

    init(id: Int, name: String, address: String? = nil) {
        self.id = id
        self.name = name
        self.address = address
    }
}

struct AppPositionOption: Identifiable, Codable {
    let id: Int
    let name: String
}

struct AppCompanyInvitePreview: Identifiable, Codable {
    let id: Int
    let name: String
    let inviteCode: String
    let branches: [AppBranchOption]
    let positions: [AppPositionOption]
}

struct CompanyBranchDraft: Identifiable, Codable, Equatable {
    let id: UUID
    var remoteID: Int?
    var name: String
    var address: String

    init(id: UUID = UUID(), remoteID: Int? = nil, name: String = "", address: String = "") {
        self.id = id
        self.remoteID = remoteID
        self.name = name
        self.address = address
    }
}

extension AppCompanySummary {
    func asAppCompany() -> AppCompany {
        AppCompany(
            id: id,
            name: name,
            address: address,
            inviteCode: inviteCode,
            inviteCodeGeneratedAt: inviteCodeGeneratedAt,
            inviteCodeExpiresAt: inviteCodeExpiresAt,
            branches: branches
        )
    }
}

extension AppCompany {
    func asSummary() -> AppCompanySummary {
        AppCompanySummary(
            id: id,
            name: name,
            address: address,
            inviteCode: inviteCode,
            inviteCodeGeneratedAt: inviteCodeGeneratedAt,
            inviteCodeExpiresAt: inviteCodeExpiresAt,
            branches: branches
        )
    }

    func withBranches(_ branches: [AppBranchOption]) -> AppCompany {
        AppCompany(
            id: id,
            name: name,
            address: address,
            inviteCode: inviteCode,
            inviteCodeGeneratedAt: inviteCodeGeneratedAt,
            inviteCodeExpiresAt: inviteCodeExpiresAt,
            branches: branches
        )
    }

    func withDetails(name: String, address: String?) -> AppCompany {
        AppCompany(
            id: id,
            name: name,
            address: address,
            inviteCode: inviteCode,
            inviteCodeGeneratedAt: inviteCodeGeneratedAt,
            inviteCodeExpiresAt: inviteCodeExpiresAt,
            branches: branches
        )
    }

    func withInviteCode(_ inviteCode: String, generatedAt: Date?, expiresAt: Date?) -> AppCompany {
        AppCompany(
            id: id,
            name: name,
            address: address,
            inviteCode: inviteCode,
            inviteCodeGeneratedAt: generatedAt,
            inviteCodeExpiresAt: expiresAt,
            branches: branches
        )
    }
}
