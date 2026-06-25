import Foundation

struct ScheduleRequirementEditorDraft: Identifiable, Equatable {
    let id = UUID()
    var requirementId: Int?
    var date: Date
    var positionId: Int?
    var quantity: Int
    var startSlot: Int
    var endSlot: Int
}
