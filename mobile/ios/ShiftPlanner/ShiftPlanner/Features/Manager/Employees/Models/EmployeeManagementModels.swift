import Foundation

struct ManagedPosition: Identifiable, Equatable {
    let id: Int
    var title: String

    init(id: Int, title: String) {
        self.id = id
        self.title = title
    }
}

struct ManagedEmployee: Identifiable, Equatable {
    let id: Int
    var fullName: String
    var email: String
    var positionId: Int?

    init(id: Int, fullName: String, email: String, positionId: Int? = nil) {
        self.id = id
        self.fullName = fullName
        self.email = email
        self.positionId = positionId
    }
}
