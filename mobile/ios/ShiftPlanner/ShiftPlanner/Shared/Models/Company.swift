import Foundation

struct AppCompanySummary: Identifiable, Codable {
    let id: Int
    let name: String
    let inviteCode: String
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

struct AppCompany: Identifiable, Codable, Equatable {
    let id: Int
    let name: String
    let inviteCode: String
    let address: String?
    let branches: [AppBranchOption]

    init(
        id: Int,
        name: String,
        inviteCode: String,
        address: String? = nil,
        branches: [AppBranchOption] = []
    ) {
        self.id = id
        self.name = name
        self.inviteCode = inviteCode
        self.address = address
        self.branches = branches
    }

    /// Returns a copy with the branch list replaced.
    func withBranches(_ branches: [AppBranchOption]) -> AppCompany {
        AppCompany(
            id: id,
            name: name,
            inviteCode: inviteCode,
            address: address,
            branches: branches
        )
    }
}

struct AppCompanyInvitePreview: Identifiable, Codable {
    let id: Int
    let name: String
    let inviteCode: String
    let branches: [AppBranchOption]
    let positions: [AppPositionOption]
}

/// A locally-edited branch. `remoteID` is nil for a branch that hasn't been
/// created on the backend yet; `id` is a stable identity for SwiftUI lists.
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
        AppCompany(id: id, name: name, inviteCode: inviteCode)
    }
}
