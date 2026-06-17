import Foundation
import Combine

@MainActor
final class RequirementsViewModel: ObservableObject {
    @Published private(set) var selectedWeekday = 0
    @Published private(set) var availablePositions: [RequirementPositionOption] = []
    @Published private(set) var requirements: [StaffingRequirement] = []
    @Published var activeDraft: StaffingRequirementDraft?
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var errorMessage: String?
    @Published var statusMessage: String?

    let weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    private let repository: RequirementsRepository
    private let hasCompany: Bool
    private var didLoadInitialData = false
    private var didLoadPositions = false
    private var calendar: Calendar
    private var nextTemporaryId = -1
    private var baselineRequirements: [StaffingRequirement] = []
    private var remoteMonthOccurrences: [RequirementOccurrence] = []

    init(
        user: AppUser,
        repository: RequirementsRepository = APIRequirementsRepository(),
        referenceDate: Date = .now
    ) {
        self.repository = repository
        self.hasCompany = user.hasCompany

        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2
        self.calendar = calendar
    }

    var canManageRequirements: Bool {
        hasCompany && !isSaving
    }

    var hasUnsavedChanges: Bool {
        requirementsSignature(for: requirements) != requirementsSignature(for: baselineRequirements)
    }

    var monthTitle: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "LLLL yyyy"
        return formatter.string(from: .now)
    }

    var selectedWeekdaySummary: String {
        weekdayLabels[selectedWeekday]
    }

    var requirementsForSelectedDay: [StaffingRequirement] {
        requirements
            .filter { $0.weekday == selectedWeekday }
            .sorted { lhs, rhs in
                if lhs.startSlot == rhs.startSlot {
                    return lhs.positionName < rhs.positionName
                }
                return lhs.startSlot < rhs.startSlot
            }
    }

    func loadInitialData() async {
        guard !didLoadInitialData else { return }
        didLoadInitialData = true

        guard hasCompany else {
            statusMessage = "Create or join a company first to manage staffing requirements."
            return
        }

        await loadPositionsIfNeeded()
        await loadCurrentMonth(forceRemote: true)
    }

    func selectWeekday(_ weekday: Int) {
        selectedWeekday = weekday
        statusMessage = nil
    }

    func startCreating() {
        guard hasCompany else {
            errorMessage = "Create or join a company first."
            return
        }

        guard let firstPosition = availablePositions.first else {
            errorMessage = "No positions found. Add positions on the backend first."
            return
        }

        activeDraft = StaffingRequirementDraft(
            id: UUID(),
            editingRequirementId: nil,
            weekdays: [selectedWeekday],
            positionId: firstPosition.id,
            quantity: 1,
            startSlot: 17,
            endSlot: 36
        )
    }

    func startEditing(_ requirement: StaffingRequirement) {
        activeDraft = StaffingRequirementDraft(
            id: UUID(),
            editingRequirementId: requirement.id,
            weekdays: [requirement.weekday],
            positionId: requirement.positionId,
            quantity: requirement.quantity,
            startSlot: requirement.startSlot,
            endSlot: requirement.endSlot
        )
    }

    func cancelEditing() {
        activeDraft = nil
    }

    func saveDraft(_ draft: StaffingRequirementDraft) -> Bool {
        guard hasCompany else {
            errorMessage = "Create or join a company first."
            return false
        }

        guard let positionId = draft.positionId,
              let position = availablePositions.first(where: { $0.id == positionId }) else {
            errorMessage = "Position is required."
            return false
        }

        let normalizedEndSlot = max(draft.endSlot, draft.startSlot + 1)
        let normalizedWeekdays = draft.weekdays.isEmpty ? [selectedWeekday] : draft.weekdays

        errorMessage = nil
        statusMessage = nil

        if let editingId = draft.editingRequirementId,
           let index = requirements.firstIndex(where: { $0.id == editingId }),
           let targetWeekday = normalizedWeekdays.sorted().first {
            requirements[index].weekday = targetWeekday
            requirements[index].positionId = position.id
            requirements[index].positionName = position.name
            requirements[index].quantity = max(1, draft.quantity)
            requirements[index].startSlot = draft.startSlot
            requirements[index].endSlot = normalizedEndSlot
            selectedWeekday = targetWeekday
            statusMessage = "Template updated locally."
        } else {
            let newItems = normalizedWeekdays.sorted().map { weekday in
                makeLocalRequirement(
                    weekday: weekday,
                    positionId: position.id,
                    positionName: position.name,
                    quantity: max(1, draft.quantity),
                    startSlot: draft.startSlot,
                    endSlot: normalizedEndSlot
                )
            }

            requirements.append(contentsOf: newItems)
            selectedWeekday = normalizedWeekdays.sorted().first ?? selectedWeekday
            statusMessage = "Template added locally."
        }

        activeDraft = nil
        return true
    }

    func delete(_ requirement: StaffingRequirement) {
        requirements.removeAll { $0.id == requirement.id }
        statusMessage = "Template removed locally."
        errorMessage = nil
    }

    func duplicate(_ requirement: StaffingRequirement) {
        let duplicated = makeLocalRequirement(
            weekday: requirement.weekday,
            positionId: requirement.positionId,
            positionName: requirement.positionName,
            quantity: requirement.quantity,
            startSlot: requirement.startSlot,
            endSlot: requirement.endSlot
        )

        requirements.append(duplicated)
        statusMessage = "Template duplicated locally."
        errorMessage = nil
    }

    func clearSelectedDay() {
        requirements.removeAll { $0.weekday == selectedWeekday }
        statusMessage = "Selected weekday cleared locally."
        errorMessage = nil
    }

    func copySelectedDay(to targetWeekdays: Set<Int>) {
        let validTargets = targetWeekdays.filter { $0 != selectedWeekday }
        let source = requirementsForSelectedDay

        guard !validTargets.isEmpty, !source.isEmpty else { return }

        requirements.removeAll { requirement in
            validTargets.contains(requirement.weekday)
        }

        let clones = validTargets.sorted().flatMap { targetWeekday in
            source.map { sourceRequirement in
                makeLocalRequirement(
                    weekday: targetWeekday,
                    positionId: sourceRequirement.positionId,
                    positionName: sourceRequirement.positionName,
                    quantity: sourceRequirement.quantity,
                    startSlot: sourceRequirement.startSlot,
                    endSlot: sourceRequirement.endSlot
                )
            }
        }

        requirements.append(contentsOf: clones)
        statusMessage = "Templates copied locally."
        errorMessage = nil
    }

    func saveChanges() async {
        guard hasCompany else {
            errorMessage = "Create or join a company first."
            return
        }

        guard hasUnsavedChanges else {
            statusMessage = "No unsaved changes."
            return
        }

        isSaving = true
        errorMessage = nil
        statusMessage = nil

        do {
            for item in remoteMonthOccurrences {
                try await repository.deleteRequirement(id: item.id)
            }

            let groupedTemplates = Dictionary(grouping: requirements, by: \.weekday)

            for (weekday, weekdayTemplates) in groupedTemplates {
                let templates = weekdayTemplates.map {
                    RequirementTemplateDraft(
                        positionId: $0.positionId,
                        quantity: $0.quantity,
                        startSlot: $0.startSlot,
                        endSlot: $0.endSlot
                    )
                }

                _ = try await repository.createRequirementsBulk(
                    startDate: currentMonthStart,
                    endDate: currentMonthEnd,
                    weekdays: [weekday],
                    templates: templates
                )
            }

            await loadCurrentMonth(forceRemote: true)
            statusMessage = "Monthly requirements synced from weekday templates."
        } catch {
            errorMessage = error.localizedDescription
        }

        isSaving = false
    }

    func autoSaveIfNeeded() async {
        guard hasUnsavedChanges, activeDraft == nil else { return }
        await saveChanges()
    }

    private var currentMonthStart: Date {
        let components = calendar.dateComponents([.year, .month], from: .now)
        return calendar.date(from: components) ?? .now
    }

    private var currentMonthEnd: Date {
        guard let start = calendar.date(from: calendar.dateComponents([.year, .month], from: .now)),
              let end = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: start) else {
            return .now
        }
        return end
    }

    private func loadPositionsIfNeeded() async {
        guard !didLoadPositions else { return }

        do {
            let loadedPositions = try await repository.fetchPositions()
            availablePositions = loadedPositions.sorted { $0.name < $1.name }
            didLoadPositions = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadCurrentMonth(forceRemote: Bool) async {
        guard hasCompany else { return }
        guard forceRemote || remoteMonthOccurrences.isEmpty else { return }

        isLoading = true
        errorMessage = nil

        do {
            let remote = try await repository.fetchRequirements(
                startDate: currentMonthStart,
                endDate: currentMonthEnd
            )
            remoteMonthOccurrences = remote
            let collapsed = collapseMonthlyOccurrences(remote)
            baselineRequirements = collapsed
            requirements = collapsed
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    private func collapseMonthlyOccurrences(_ occurrences: [RequirementOccurrence]) -> [StaffingRequirement] {
        var unique: [String: StaffingRequirement] = [:]

        for occurrence in occurrences {
            let key = "\(occurrence.weekday)|\(occurrence.positionId)|\(occurrence.quantity)|\(occurrence.startSlot)|\(occurrence.endSlot)"
            if unique[key] == nil {
                unique[key] = StaffingRequirement(
                    id: occurrence.id,
                    weekday: occurrence.weekday,
                    positionId: occurrence.positionId,
                    positionName: occurrence.positionName,
                    quantity: occurrence.quantity,
                    startSlot: occurrence.startSlot,
                    endSlot: occurrence.endSlot
                )
            }
        }

        return unique.values.sorted { lhs, rhs in
            if lhs.weekday == rhs.weekday {
                if lhs.startSlot == rhs.startSlot {
                    return lhs.positionName < rhs.positionName
                }
                return lhs.startSlot < rhs.startSlot
            }
            return lhs.weekday < rhs.weekday
        }
    }

    private func makeLocalRequirement(
        weekday: Int,
        positionId: Int,
        positionName: String,
        quantity: Int,
        startSlot: Int,
        endSlot: Int
    ) -> StaffingRequirement {
        defer { nextTemporaryId -= 1 }
        return StaffingRequirement(
            id: nextTemporaryId,
            weekday: weekday,
            positionId: positionId,
            positionName: positionName,
            quantity: quantity,
            startSlot: startSlot,
            endSlot: endSlot
        )
    }

    private func requirementsSignature(for items: [StaffingRequirement]) -> [String] {
        items.map(contentSignature(for:)).sorted()
    }

    private func contentSignature(for item: StaffingRequirement) -> String {
        "\(item.weekday)|\(item.positionId)|\(item.quantity)|\(item.startSlot)|\(item.endSlot)"
    }
}
