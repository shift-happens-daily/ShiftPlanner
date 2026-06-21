import Foundation

struct AppCompanySummary: Identifiable, Codable {
    let id: Int
    let name: String
    let address: String?
    let inviteCode: String
    let branches: [AppBranchOption]
}

struct AppCompany: Identifiable, Codable {
    let id: Int
    let name: String
    let address: String?
    let inviteCode: String
    let branches: [AppBranchOption]
}

struct AppBranchOption: Identifiable, Codable {
    let id: Int
    let name: String
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
    var name: String
    var address: String

    init(id: UUID = UUID(), name: String = "", address: String = "") {
        self.id = id
        self.name = name
        self.address = address
    }
}

extension AppCompanySummary {
    func asAppCompany() -> AppCompany {
        AppCompany(id: id, name: name, address: address, inviteCode: inviteCode, branches: branches)
    }
}

extension AppCompany {
    func asSummary() -> AppCompanySummary {
        AppCompanySummary(id: id, name: name, address: address, inviteCode: inviteCode, branches: branches)
    }

    func withBranches(_ branches: [AppBranchOption]) -> AppCompany {
        AppCompany(id: id, name: name, address: address, inviteCode: inviteCode, branches: branches)
    }

    func withDetails(name: String, address: String?) -> AppCompany {
        AppCompany(id: id, name: name, address: address, inviteCode: inviteCode, branches: branches)
    }
}
