import Foundation
import Combine

@MainActor
final class ManagerScheduleViewModel: ObservableObject {
    @Published var startDate: Date
    @Published var endDate: Date
    @Published private(set) var schedule: AppSchedule?
    @Published private(set) var employees: [ManagedEmployee] = []
    @Published private(set) var availablePositions: [RequirementPositionOption] = []
    @Published private(set) var recommendedEmployees: [AppAvailableEmployee] = []
    @Published private(set) var recommendedEmployeesForRequirement: [AppAvailableEmployee] = []
    @Published var isLoading = false
    @Published var isGenerating = false
    @Published var isPublishing = false
    @Published var isSavingShift = false
    @Published var isLoadingRecommendedEmployees = false
    @Published var isAssigningRequirement = false
    @Published var isSavingRequirement = false
    @Published var errorMessage: String?
    @Published var statusMessage: String?

    private let repository: ScheduleRepository
    private let employeeRepository: EmployeeManagementRepository
    private let requirementsRepository: RequirementsRepository
    private let hasCompany: Bool
    private var requirementOccurrencesById: [Int: RequirementOccurrence] = [:]

    init(
        user: AppUser,
        repository: ScheduleRepository? = nil,
        employeeRepository: EmployeeManagementRepository? = nil,
        requirementsRepository: RequirementsRepository? = nil,
        referenceDate: Date = .now
    ) {
        self.repository = repository ?? APIScheduleRepository()
        self.employeeRepository = employeeRepository ?? APIEmployeeManagementRepository(companyId: user.company?.id)
        self.requirementsRepository = requirementsRepository ?? APIRequirementsRepository()
        self.hasCompany = user.hasCompany

        let calendar = Calendar(identifier: .gregorian)
        let monthComponents = calendar.dateComponents([.year, .month], from: referenceDate)
        let monthStart = calendar.date(from: monthComponents) ?? referenceDate
        let monthEnd = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: monthStart) ?? referenceDate

        self.startDate = monthStart
        self.endDate = monthEnd
    }

    var canGenerate: Bool {
        hasCompany && !isGenerating && !isPublishing && startDate <= endDate
    }

    var canPublish: Bool {
        hasCompany && !isGenerating && !isPublishing && schedule?.status == .draft
    }

    var hasSchedule: Bool {
        schedule != nil
    }

    var scheduleTitle: String {
        guard let schedule else {
            return localized("No schedule generated yet", "Расписание пока не сгенерировано")
        }
        return localized("Schedule #\(schedule.id)", "Расписание №\(schedule.id)")
    }

    func loadLatestSchedule() async {
        guard hasCompany else {
            schedule = nil
            employees = []
            availablePositions = []
            requirementOccurrencesById = [:]
            statusMessage = localized(
                "Create or join a company first to generate schedules.",
                "Сначала создайте компанию или присоединитесь к ней, чтобы генерировать расписание."
            )
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            if let draftSchedule = try await repository.fetchLatestSchedule(status: .draft) {
                schedule = draftSchedule
                statusMessage = localized("Latest draft schedule loaded.", "Загружен последний черновик расписания.")
            } else if let publishedSchedule = try await repository.fetchLatestSchedule(status: .published) {
                schedule = publishedSchedule
                statusMessage = localized("Latest published schedule loaded.", "Загружено последнее опубликованное расписание.")
            } else {
                schedule = nil
                statusMessage = localized(
                    "Generate a schedule after requirements and availability are filled in.",
                    "Сгенерируйте расписание после заполнения требований и доступности."
                )
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        do {
            employees = try await employeeRepository.fetchEmployees()
        } catch {
            employees = []
            if errorMessage == nil {
                errorMessage = error.localizedDescription
            }
        }

        do {
            let loadedPositions = try await requirementsRepository.fetchPositions()
            availablePositions = sortedPositionOptions(loadedPositions)
        } catch {
            availablePositions = fallbackPositions()
            if errorMessage == nil {
                errorMessage = error.localizedDescription
            }
        }

        do {
            try await refreshRequirementOccurrences()
            mergeFallbackPositions()
        } catch {
            requirementOccurrencesById = [:]
            mergeFallbackPositions()
            if errorMessage == nil {
                errorMessage = error.localizedDescription
            }
        }

        isLoading = false
    }

    func generateSchedule() async {
        guard canGenerate else { return }

        isGenerating = true
        errorMessage = nil
        statusMessage = nil

        do {
            schedule = try await repository.generateSchedule(startDate: startDate, endDate: endDate)
            try await refreshRequirementOccurrences()
            mergeFallbackPositions()
            statusMessage = localized("Schedule generated successfully.", "Расписание успешно сгенерировано.")
        } catch {
            errorMessage = error.localizedDescription
        }

        isGenerating = false
    }

    func publishSchedule() async {
        guard canPublish, let schedule else { return }

        isPublishing = true
        errorMessage = nil
        statusMessage = nil

        do {
            self.schedule = try await repository.publishSchedule(scheduleId: schedule.id)
            try await refreshRequirementOccurrences()
            mergeFallbackPositions()
            statusMessage = localized("Schedule published successfully.", "Расписание успешно опубликовано.")
        } catch {
            errorMessage = error.localizedDescription
        }

        isPublishing = false
    }

    func saveShift(_ draft: ScheduleShiftEditorDraft) async -> Bool {
        guard let schedule else {
            errorMessage = localized("Generate or load a schedule first.", "Сначала загрузите или сгенерируйте расписание.")
            return false
        }

        guard let positionId = resolvedPositionId(
            draft.positionId,
            fallbackName: draft.positionName
        ) else {
            errorMessage = localized("Position is required.", "Выберите должность.")
            return false
        }

        logShiftDraftBeforeSave(draft)

        isSavingShift = true
        errorMessage = nil
        statusMessage = nil

        do {
            let payload = ScheduleShiftMutation(
                date: draft.date,
                startMinutes: draft.startSlot * 30,
                endMinutes: draft.endSlot * 30,
                positionId: positionId,
                employeeId: draft.employeeId
            )

            if let shiftId = draft.shiftId {
                self.schedule = try await repository.updateShift(
                    scheduleId: schedule.id,
                    shiftId: shiftId,
                    payload: payload
                )
            } else {
                self.schedule = try await repository.createShift(
                    scheduleId: schedule.id,
                    payload: payload
                )
            }

            try await refreshRequirementOccurrences()
            mergeFallbackPositions()
            statusMessage = localized(
                "Schedule updated successfully.",
                "Расписание успешно обновлено."
            )
            isSavingShift = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isSavingShift = false
            return false
        }
    }

    func deleteShift(_ draft: ScheduleShiftEditorDraft) async -> Bool {
        guard let schedule, let shiftId = draft.shiftId else { return false }

        isSavingShift = true
        errorMessage = nil
        statusMessage = nil

        do {
            self.schedule = try await repository.deleteShift(
                scheduleId: schedule.id,
                shiftId: shiftId
            )
            try await refreshRequirementOccurrences()
            mergeFallbackPositions()
            statusMessage = localized(
                "Shift removed successfully.",
                "Смена успешно удалена."
            )
            isSavingShift = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isSavingShift = false
            return false
        }
    }

    func loadRecommendedEmployees(for shift: AppScheduledShift) async {
        guard let schedule else {
            recommendedEmployees = []
            return
        }

        isLoadingRecommendedEmployees = true

        do {
            recommendedEmployees = try await repository.fetchAvailableEmployees(
                scheduleId: schedule.id,
                shift: shift,
                branchId: nil
            )
        } catch {
            recommendedEmployees = []
            errorMessage = error.localizedDescription
        }

        isLoadingRecommendedEmployees = false
    }

    func loadRecommendedEmployees(for requirement: AppUnfilledRequirement) async {
        guard let schedule else {
            recommendedEmployeesForRequirement = []
            return
        }

        isLoadingRecommendedEmployees = true

        let syntheticShift = AppScheduledShift(
            id: requirement.id,
            employeeId: nil,
            employeeName: nil,
            positionId: requirement.positionId,
            positionName: requirement.positionTitle,
            date: requirement.date,
            startMinutes: requirement.startMinutes,
            endMinutes: requirement.endMinutes
        )

        do {
            let branchId = requirementOccurrencesById[requirement.id]?.branchId
            recommendedEmployeesForRequirement = try await repository.fetchAvailableEmployees(
                scheduleId: schedule.id,
                shift: syntheticShift,
                branchId: branchId
            )
        } catch {
            recommendedEmployeesForRequirement = []
            errorMessage = error.localizedDescription
        }

        isLoadingRecommendedEmployees = false
    }

    func clearRecommendedEmployees() {
        recommendedEmployees = []
        recommendedEmployeesForRequirement = []
        isLoadingRecommendedEmployees = false
    }

    func loadRecommendedEmployees(for draft: ScheduleShiftEditorDraft) async {
        guard let schedule, let positionId = draft.positionId else {
            recommendedEmployees = []
            return
        }

        isLoadingRecommendedEmployees = true

        let syntheticShift = AppScheduledShift(
            id: draft.shiftId ?? -1,
            employeeId: draft.employeeId,
            employeeName: nil,
            positionId: positionId,
            positionName: availablePositions.first(where: { $0.id == positionId })?.name ?? "",
            date: draft.date,
            startMinutes: draft.startSlot * 30,
            endMinutes: draft.endSlot * 30
        )

        do {
            recommendedEmployees = try await repository.fetchAvailableEmployees(
                scheduleId: schedule.id,
                shift: syntheticShift,
                branchId: nil
            )
        } catch {
            recommendedEmployees = []
            errorMessage = error.localizedDescription
        }

        isLoadingRecommendedEmployees = false
    }

    func assignRequirement(_ requirement: AppUnfilledRequirement, employee: ManagedEmployee) async {
        await assignRequirement(requirement, employeeId: employee.id)
    }

    func assignRequirement(_ requirement: AppUnfilledRequirement, employeeId: Int) async {
        guard let schedule else { return }

        let branchId = requirementOccurrencesById[requirement.id]?.branchId

        let employee = employees.first(where: { $0.id == employeeId })

        if let employee,
           let employeePositionId = employee.positionId,
           employeePositionId != requirement.positionId {
            errorMessage = localized(
                "The selected employee does not match this position.",
                "Выбранный сотрудник не соответствует этой должности."
            )
            return
        }

        if let branchId,
           let employee,
           let employeeBranchId = employee.branchId,
           employeeBranchId != branchId {
            errorMessage = localized(
                "The selected employee does not belong to the required branch.",
                "Выбранный сотрудник не относится к нужному филиалу."
            )
            return
        }

        isAssigningRequirement = true
        errorMessage = nil
        statusMessage = nil

        do {
            self.schedule = try await repository.assignRequirement(
                scheduleId: schedule.id,
                requirementId: requirement.id,
                employeeId: employeeId
            )
            try await refreshRequirementOccurrences()
            statusMessage = localized(
                "Employee assigned to the unfilled shift.",
                "Сотрудник назначен на незаполненную смену."
            )
        } catch {
            errorMessage = error.localizedDescription
        }

        isAssigningRequirement = false
    }

    func makeRequirementDraft(for date: Date) -> ScheduleRequirementEditorDraft? {
        guard hasCompany else {
            errorMessage = localized("Create or join a company first.", "Сначала создайте компанию или присоединитесь к ней.")
            return nil
        }

        guard let firstPosition = availablePositions.first else {
            errorMessage = localized("No positions found. Add at least one position first.", "Сначала добавьте хотя бы одну должность.")
            return nil
        }

        errorMessage = nil

        return ScheduleRequirementEditorDraft(
            requirementId: nil,
            date: date,
            positionId: firstPosition.id,
            positionName: firstPosition.name,
            quantity: 1,
            startSlot: 16,
            endSlot: 24
        )
    }

    func makeShiftDraft(for date: Date) -> ScheduleShiftEditorDraft? {
        guard hasCompany else {
            errorMessage = localized("Create or join a company first.", "Сначала создайте компанию или присоединитесь к ней.")
            return nil
        }

        guard schedule != nil else {
            errorMessage = localized("Generate or load a schedule first.", "Сначала загрузите или сгенерируйте расписание.")
            return nil
        }

        guard let firstPosition = availablePositions.first else {
            errorMessage = localized("No positions found. Add at least one position first.", "Сначала добавьте хотя бы одну должность.")
            return nil
        }

        errorMessage = nil

        return ScheduleShiftEditorDraft(
            shiftId: nil,
            date: date,
            positionId: firstPosition.id,
            positionName: firstPosition.name,
            employeeId: nil,
            startSlot: 16,
            endSlot: 24
        )
    }

    func makeShiftDraft(for shift: AppScheduledShift) -> ScheduleShiftEditorDraft {
        let positionId = resolvedPositionId(
            shift.positionId,
            fallbackName: shift.positionName
        ) ?? shift.positionId

        return ScheduleShiftEditorDraft(
            shiftId: shift.id,
            date: shift.date,
            positionId: positionId,
            positionName: shift.positionName,
            employeeId: shift.employeeId,
            startSlot: max(0, shift.startMinutes / 30),
            endSlot: max((shift.startMinutes / 30) + 1, shift.endMinutes / 30)
        )
    }

    func makeRequirementDraft(for requirement: AppUnfilledRequirement) -> ScheduleRequirementEditorDraft {
        let occurrence = requirementOccurrencesById[requirement.id]
        let positionName = occurrence?.positionName ?? requirement.positionTitle
        let positionId = resolvedPositionId(
            occurrence?.positionId ?? requirement.positionId,
            fallbackName: positionName
        ) ?? occurrence?.positionId ?? requirement.positionId

        return ScheduleRequirementEditorDraft(
            requirementId: requirement.id,
            date: requirement.date,
            positionId: positionId,
            positionName: positionName,
            quantity: occurrence?.quantity ?? max(1, requirement.missingStaff),
            startSlot: occurrence?.startSlot ?? max(0, requirement.startMinutes / 30),
            endSlot: occurrence?.endSlot ?? max((requirement.startMinutes / 30) + 1, requirement.endMinutes / 30)
        )
    }

    func eligibleEmployees(
        for positionId: Int?,
        branchId: Int? = nil
    ) -> [ManagedEmployee] {
        employees.filter { employee in
            let matchesPosition = positionId == nil || employee.positionId == positionId
            let matchesBranch = branchId == nil || employee.branchId == branchId
            return matchesPosition && matchesBranch
        }
    }

    func requirementBranchId(for requirement: AppUnfilledRequirement) -> Int? {
        requirementOccurrencesById[requirement.id]?.branchId
    }

    func saveRequirement(_ draft: ScheduleRequirementEditorDraft) async -> Bool {
        guard hasCompany else {
            errorMessage = localized("Create or join a company first.", "Сначала создайте компанию или присоединитесь к ней.")
            return false
        }

        guard let positionId = resolvedPositionId(
            draft.positionId,
            fallbackName: draft.positionName
        ) else {
            errorMessage = localized("Position is required.", "Выберите должность.")
            return false
        }

        isSavingRequirement = true
        errorMessage = nil
        statusMessage = nil

        do {
            let normalizedEndSlot = max(draft.endSlot, draft.startSlot + 1)

            if let requirementId = draft.requirementId {
                guard let schedule else {
                    errorMessage = localized("Generate or load a schedule first.", "Сначала загрузите или сгенерируйте расписание.")
                    isSavingRequirement = false
                    return false
                }

                self.schedule = try await repository.updateScheduleRequirement(
                    scheduleId: schedule.id,
                    requirementId: requirementId,
                    date: draft.date,
                    positionId: positionId,
                    quantity: max(1, draft.quantity),
                    startSlot: draft.startSlot,
                    endSlot: normalizedEndSlot
                )
            } else {
                _ = try await requirementsRepository.createRequirement(
                    date: draft.date,
                    branchId: nil,
                    positionId: positionId,
                    quantity: max(1, draft.quantity),
                    startSlot: draft.startSlot,
                    endSlot: normalizedEndSlot
                )
            }

            if draft.requirementId == nil {
                try await refreshCurrentSchedule()
            }
            try await refreshRequirementOccurrences()
            statusMessage = localized(
                "Unfilled shift updated successfully.",
                "Незаполненная смена успешно обновлена."
            )
            isSavingRequirement = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isSavingRequirement = false
            return false
        }
    }

    func deleteRequirement(_ requirement: AppUnfilledRequirement) async -> Bool {
        isSavingRequirement = true
        errorMessage = nil
        statusMessage = nil

        do {
            try await requirementsRepository.deleteRequirement(id: requirement.id)
            try await refreshCurrentSchedule()
            try await refreshRequirementOccurrences()
            statusMessage = localized(
                "Unfilled shift removed successfully.",
                "Незаполненная смена успешно удалена."
            )
            isSavingRequirement = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isSavingRequirement = false
            return false
        }
    }

    private func refreshCurrentSchedule() async throws {
        if let currentSchedule = schedule {
            schedule = try await repository.fetchSchedule(scheduleId: currentSchedule.id)
            mergeFallbackPositions()
            return
        }

        schedule = try await repository.fetchLatestSchedule(status: .draft)
        mergeFallbackPositions()
    }

    private func refreshRequirementOccurrences() async throws {
        let occurrences = try await requirementsRepository.fetchRequirements(
            startDate: startDate,
            endDate: endDate
        )

        requirementOccurrencesById = Dictionary(
            uniqueKeysWithValues: occurrences.map { ($0.id, $0) }
        )
    }

    private func fallbackPositions() -> [RequirementPositionOption] {
        var optionsById: [Int: RequirementPositionOption] = [:]

        for shift in schedule?.shifts ?? [] {
            optionsById[shift.positionId] = RequirementPositionOption(
                id: shift.positionId,
                name: shift.positionName
            )
        }

        for occurrence in requirementOccurrencesById.values {
            optionsById[occurrence.positionId] = RequirementPositionOption(
                id: occurrence.positionId,
                name: occurrence.positionName
            )
        }

        return optionsById.values.sorted {
            $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    private func mergeFallbackPositions() {
        availablePositions = sortedPositionOptions(availablePositions + fallbackPositions())
    }

    private func sortedPositionOptions(_ options: [RequirementPositionOption]) -> [RequirementPositionOption] {
        var optionsById: [Int: RequirementPositionOption] = [:]

        for option in options where option.id > 0 {
            optionsById[option.id] = option
        }

        return optionsById.values.sorted {
            $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    private func resolvedPositionId(_ candidateId: Int?, fallbackName: String?) -> Int? {
        if let candidateId, candidateId > 0 {
            return candidateId
        }

        guard let fallbackName else { return nil }
        let normalizedFallback = normalizedPositionName(fallbackName)

        return availablePositions.first {
            normalizedPositionName($0.name) == normalizedFallback
        }?.id
    }

    private func normalizedPositionName(_ name: String) -> String {
        name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private func logShiftDraftBeforeSave(_ draft: ScheduleShiftEditorDraft) {
        #if DEBUG
        let positionSummary = availablePositions
            .map { "\($0.id):\($0.name)" }
            .joined(separator: ", ")
        print(
            "ScheduleShiftEditor save draft positionId=\(draft.positionId.map(String.init) ?? "nil") " +
            "employeeId=\(draft.employeeId.map(String.init) ?? "nil") " +
            "availablePositions=[\(positionSummary)]"
        )
        #endif
    }
}
