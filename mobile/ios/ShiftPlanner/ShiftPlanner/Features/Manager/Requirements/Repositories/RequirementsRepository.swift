import Foundation

protocol RequirementsRepository {
    func fetchPositions() async throws -> [RequirementPositionOption]
    func fetchRequirements(startDate: Date, endDate: Date) async throws -> [RequirementOccurrence]
    func createRequirementsBulk(
        startDate: Date,
        endDate: Date,
        weekdays: [Int],
        templates: [RequirementTemplateDraft]
    ) async throws -> [RequirementOccurrence]
    func deleteRequirement(id: Int) async throws
}
