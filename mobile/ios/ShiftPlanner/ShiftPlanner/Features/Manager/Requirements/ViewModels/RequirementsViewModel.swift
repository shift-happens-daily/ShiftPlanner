import Foundation
import Combine

@MainActor
final class RequirementsViewModel: ObservableObject {
    @Published private(set) var selectedWeekday = 0
    @Published private(set) var availablePositions: [RequirementPositionOption] = []
    @Published private(set) var requirements: [StaffingRequirement] = []
    @Published private(set) var workingHoursByWeekday: [Int: DayWorkingHours] = [:]
    @Published var activeDraft: StaffingRequirementDraft?
    @Published var isLoading = false
    @Published var isSaving = false
    @Published private(set) var deletingRequirementIDs: Set<Int> = []
    @Published var errorMessage: String?
    @Published var statusMessage: String?

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
        repository: RequirementsRepository? = nil,
        referenceDate: Date = .now
    ) {
        self.repository = repository ?? APIRequirementsRepository()
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
        formatter.locale = LanguageManager.storedLocale
        formatter.dateFormat = "LLLL yyyy"
        return formatter.string(from: .now)
    }

    var weekdayLabels: [String] {
        let formatter = DateFormatter()
        formatter.locale = LanguageManager.storedLocale
        return formatter.shortWeekdaySymbols
            .map { $0.capitalized }
            .reorderedFromSundayToMonday()
    }

    var selectedWeekdaySummary: String {
        weekdayLabels[selectedWeekday]
    }

    var selectedDayWorkingHours: DayWorkingHours {
        workingHours(for: selectedWeekday)
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
            statusMessage = localized("Create or join a company first to manage staffing requirements.", "Сначала создайте компанию или присоединитесь к ней, чтобы управлять требованиями.")
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
            errorMessage = localized("Create or join a company first.", "Сначала создайте компанию или присоединитесь к ней.")
            return
        }

        guard let firstPosition = availablePositions.first else {
            errorMessage = localized("No positions found. Add positions on the backend first.", "Должности не найдены. Сначала добавьте их на бэкенде.")
            return
        }

        activeDraft = StaffingRequirementDraft(
            id: UUID(),
            editingRequirementId: nil,
            weekdays: [selectedWeekday],
            positionId: firstPosition.id,
            quantity: 1,
            startSlot: selectedDayWorkingHours.startSlot,
            endSlot: selectedDayWorkingHours.endSlot
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
            errorMessage = localized("Create or join a company first.", "Сначала создайте компанию или присоединитесь к ней.")
            return false
        }

        guard let positionId = draft.positionId,
              let position = availablePositions.first(where: { $0.id == positionId }) else {
            errorMessage = localized("Position is required.", "Выберите должность.")
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
            statusMessage = localized("Requirement updated. Changes will be synced automatically.", "Требование обновлено. Изменения будут синхронизированы автоматически.")
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
            statusMessage = localized("Requirement added. Changes will be synced automatically.", "Требование добавлено. Изменения будут синхронизированы автоматически.")
        }

        activeDraft = nil
        return true
    }

    func delete(_ requirement: StaffingRequirement) async {
        errorMessage = nil
        statusMessage = nil

        let matchingRemoteOccurrences = remoteMonthOccurrences.filter {
            contentSignature(for: $0) == contentSignature(for: requirement)
        }

        if !matchingRemoteOccurrences.isEmpty {
            let deletingIds = Set(matchingRemoteOccurrences.map(\.id))
            deletingRequirementIDs.formUnion(deletingIds)
            defer { deletingRequirementIDs.subtract(deletingIds) }

            do {
                for occurrence in matchingRemoteOccurrences {
                    try await repository.deleteRequirement(id: occurrence.id)
                }
                await loadCurrentMonth(forceRemote: true)
                statusMessage = localized("Requirement deleted successfully.", "Требование успешно удалено.")
            } catch {
                errorMessage = error.localizedDescription
            }

            return
        }

        requirements.removeAll { $0.id == requirement.id }
        synchronizeWorkingHours(with: requirements)
        statusMessage = localized("Requirement deleted. Changes will be synced automatically.", "Требование удалено. Изменения будут синхронизированы автоматически.")
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
        statusMessage = localized("Requirement duplicated. Changes will be synced automatically.", "Требование продублировано. Изменения будут синхронизированы автоматически.")
        errorMessage = nil
    }

    func clearSelectedDay() {
        requirements.removeAll { $0.weekday == selectedWeekday }
        statusMessage = localized("Selected day cleared. Changes will be synced automatically.", "Выбранный день очищен. Изменения будут синхронизированы автоматически.")
        errorMessage = nil
    }

    func clearAllDays() {
        requirements.removeAll()
        workingHoursByWeekday = [:]
        statusMessage = localized("All weekdays cleared. Changes will be synced automatically.", "Все дни недели очищены. Изменения будут синхронизированы автоматически.")
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
        for weekday in validTargets {
            workingHoursByWeekday[weekday] = selectedDayWorkingHours
        }
        statusMessage = localized("Requirements copied. Changes will be synced automatically.", "Требования скопированы. Изменения будут синхронизированы автоматически.")
        errorMessage = nil
    }

    func updateWorkingHours(startSlot: Int, endSlot: Int) {
        let normalizedStart = min(max(startSlot, 0), 43)
        let normalizedEnd = min(max(endSlot, normalizedStart + 1), 44)

        workingHoursByWeekday[selectedWeekday] = DayWorkingHours(
            startSlot: normalizedStart,
            endSlot: normalizedEnd
        )

        requirements = requirements.compactMap { requirement in
            guard requirement.weekday == selectedWeekday else { return requirement }

            let clampedStart = max(requirement.startSlot, normalizedStart)
            let clampedEnd = min(requirement.endSlot, normalizedEnd)

            guard clampedEnd > clampedStart else { return nil }

            var updatedRequirement = requirement
            updatedRequirement.startSlot = clampedStart
            updatedRequirement.endSlot = clampedEnd
            return updatedRequirement
        }

        statusMessage = localized("Working hours updated. Changes will be synced automatically.", "Рабочие часы обновлены. Изменения будут синхронизированы автоматически.")
        errorMessage = nil
    }

    func workingHours(for weekday: Int) -> DayWorkingHours {
        if let storedHours = workingHoursByWeekday[weekday] {
            return storedHours
        }

        let dayRequirements = requirements.filter { $0.weekday == weekday }
        guard !dayRequirements.isEmpty else {
            return defaultWorkingHours
        }

        return DayWorkingHours(
            startSlot: dayRequirements.map(\.startSlot).min() ?? defaultWorkingHours.startSlot,
            endSlot: dayRequirements.map(\.endSlot).max() ?? defaultWorkingHours.endSlot
        )
    }

    func saveChanges() async {
        guard hasCompany else {
            errorMessage = localized("Create or join a company first.", "Сначала создайте компанию или присоединитесь к ней.")
            return
        }

        guard hasUnsavedChanges else {
            statusMessage = localized("No unsaved changes.", "Несохраненных изменений нет.")
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
            statusMessage = localized("Monthly requirements synced from weekday templates.", "Требования на месяц синхронизированы из шаблонов по дням недели.")
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
            synchronizeWorkingHours(with: collapsed)
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

    private var defaultWorkingHours: DayWorkingHours {
        DayWorkingHours(startSlot: 16, endSlot: 36)
    }

    private func synchronizeWorkingHours(with requirements: [StaffingRequirement]) {
        var updated: [Int: DayWorkingHours] = [:]

        for weekday in 0..<weekdayLabels.count {
            let dayRequirements = requirements.filter { $0.weekday == weekday }

            if dayRequirements.isEmpty {
                updated[weekday] = workingHoursByWeekday[weekday] ?? defaultWorkingHours
                continue
            }

            updated[weekday] = DayWorkingHours(
                startSlot: dayRequirements.map(\.startSlot).min() ?? defaultWorkingHours.startSlot,
                endSlot: dayRequirements.map(\.endSlot).max() ?? defaultWorkingHours.endSlot
            )
        }

        workingHoursByWeekday = updated
    }

    private func requirementsSignature(for items: [StaffingRequirement]) -> [String] {
        items.map(contentSignature(for:)).sorted()
    }

    private func contentSignature(for item: StaffingRequirement) -> String {
        "\(item.weekday)|\(item.positionId)|\(item.quantity)|\(item.startSlot)|\(item.endSlot)"
    }

    private func contentSignature(for occurrence: RequirementOccurrence) -> String {
        "\(occurrence.weekday)|\(occurrence.positionId)|\(occurrence.quantity)|\(occurrence.startSlot)|\(occurrence.endSlot)"
    }
}
