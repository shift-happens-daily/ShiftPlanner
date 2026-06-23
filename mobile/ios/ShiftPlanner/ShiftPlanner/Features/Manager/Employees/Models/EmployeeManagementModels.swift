import Foundation

struct ManagedPosition: Identifiable, Equatable {
    let id: Int
    var title: String

    init(id: Int, title: String) {
        self.id = id
        self.title = title
    }
}

struct ManagedBranch: Identifiable, Equatable {
    let id: Int
    var name: String

    init(id: Int, name: String) {
        self.id = id
        self.name = name
    }
}

struct ManagedEmployee: Identifiable, Equatable {
    let id: Int
    var publicId: String
    var fullName: String
    var email: String
    var role: UserRole
    var branchId: Int?
    var branchName: String?
    var positionId: Int?
    var positionTitle: String?

    init(
        id: Int,
        publicId: String = "",
        fullName: String,
        email: String,
        role: UserRole = .employee,
        branchId: Int? = nil,
        branchName: String? = nil,
        positionId: Int? = nil,
        positionTitle: String? = nil
    ) {
        self.id = id
        self.publicId = publicId
        self.fullName = fullName
        self.email = email
        self.role = role
        self.branchId = branchId
        self.branchName = branchName
        self.positionId = positionId
        self.positionTitle = positionTitle
    }
}
