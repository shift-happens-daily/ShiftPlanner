import Foundation

struct DayWorkingHours: Equatable {
    var startSlot: Int
    var endSlot: Int
}

struct StaffingRequirement: Identifiable, Equatable {
    let id: Int
    var weekday: Int
    var positionId: Int
    var positionName: String
    var quantity: Int
    var startSlot: Int
    var endSlot: Int
}

struct RequirementOccurrence: Identifiable, Equatable {
    let id: Int
    let date: Date
    let weekday: Int
    let positionId: Int
    let positionName: String
    let quantity: Int
    let startSlot: Int
    let endSlot: Int
    /// Branch this requirement belongs to; nil = the company's default branch.
    let branchId: Int?

    init(
        id: Int,
        date: Date,
        weekday: Int,
        positionId: Int,
        positionName: String,
        quantity: Int,
        startSlot: Int,
        endSlot: Int,
        branchId: Int? = nil
    ) {
        self.id = id
        self.date = date
        self.weekday = weekday
        self.positionId = positionId
        self.positionName = positionName
        self.quantity = quantity
        self.startSlot = startSlot
        self.endSlot = endSlot
        self.branchId = branchId
    }
}

struct RequirementPositionOption: Identifiable, Hashable {
    let id: Int
    let name: String
}

struct StaffingRequirementDraft: Identifiable {
    let id: UUID
    var editingRequirementId: Int?
    var weekdays: Set<Int>
    var positionId: Int?
    var quantity: Int
    var startSlot: Int
    var endSlot: Int
}

struct RequirementTemplateDraft: Hashable {
    let positionId: Int
    let quantity: Int
    let startSlot: Int
    let endSlot: Int
}
