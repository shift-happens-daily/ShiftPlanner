import Foundation

struct ManagedPosition: Identifiable, Equatable {
    let id: UUID
    var title: String

    init(id: UUID = UUID(), title: String) {
        self.id = id
        self.title = title
    }
}

struct ManagedEmployee: Identifiable, Equatable {
    let id: UUID
    var fullName: String
    var email: String
    var positionId: UUID?

    init(id: UUID = UUID(), fullName: String, email: String, positionId: UUID? = nil) {
        self.id = id
        self.fullName = fullName
        self.email = email
        self.positionId = positionId
    }
}
