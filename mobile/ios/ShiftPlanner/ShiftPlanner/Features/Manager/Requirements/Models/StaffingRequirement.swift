import Foundation

struct StaffingRequirement: Identifiable, Equatable {
    let id: UUID
    var weekday: Int
    var positionId: UUID
    var positionName: String
    var quantity: Int
    var startSlot: Int
    var endSlot: Int
}

struct RequirementPositionOption: Identifiable, Hashable {
    let id: UUID
    let name: String
}

struct StaffingRequirementDraft: Identifiable {
    let id: UUID
    var editingRequirementId: UUID?
    var weekdays: Set<Int>
    var positionId: UUID?
    var quantity: Int
    var startSlot: Int
    var endSlot: Int
}
