import Foundation

protocol RequirementsRepository {
    func fetchPositions() async throws -> [RequirementPositionOption]
    func fetchRequirements(startDate: Date, endDate: Date) async throws -> [RequirementOccurrence]
    func createRequirement(
        date: Date,
        branchId: Int?,
        positionId: Int,
        quantity: Int,
        startSlot: Int,
        endSlot: Int
    ) async throws -> RequirementOccurrence
    func updateRequirement(
        id: Int,
        date: Date,
        branchId: Int?,
        positionId: Int,
        quantity: Int,
        startSlot: Int,
        endSlot: Int
    ) async throws -> RequirementOccurrence
    func createRequirementsBulk(
        startDate: Date,
        endDate: Date,
        weekdays: [Int],
        templates: [RequirementTemplateDraft]
    ) async throws -> [RequirementOccurrence]
    func deleteRequirement(id: Int) async throws
}
