import Foundation
import Combine

@MainActor
final class ManagerScheduleViewModel: ObservableObject {
    @Published var startDate: Date
    @Published var endDate: Date
    @Published private(set) var schedule: AppSchedule?
    @Published private(set) var employees: [ManagedEmployee] = []
    @Published private(set) var availablePositions: [RequirementPositionOption] = []
    @Published var isLoading = false
    @Published var isGenerating = false
    @Published var isPublishing = false
    @Published var isUpdatingShift = false
    @Published var isSavingRequirement = false
    @Published var errorMessage: String?
    @Published var statusMessage: String?

    private let repository: ScheduleRepository
    private let employeeRepository: EmployeeManagementRepository
    private let requirementsRepository: RequirementsRepository
    private let hasCompany: Bool
    private var didLoadSchedule = false
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

    func loadScheduleIfNeeded() async {
        guard !didLoadSchedule else { return }
        didLoadSchedule = true
        await loadLatestSchedule()
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
            async let employeesRequest = employeeRepository.fetchEmployees()
            async let positionsRequest = requirementsRepository.fetchPositions()

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

            employees = try await employeesRequest
            availablePositions = try await positionsRequest
            try await refreshRequirementOccurrences()
        } catch {
            errorMessage = error.localizedDescription
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
            statusMessage = localized("Schedule published successfully.", "Расписание успешно опубликовано.")
        } catch {
            errorMessage = error.localizedDescription
        }

        isPublishing = false
    }

    func updateShift(_ shift: AppScheduledShift, action: ScheduleShiftUpdateAction) async {
        guard let schedule else { return }

        isUpdatingShift = true
        errorMessage = nil
        statusMessage = nil

        do {
            self.schedule = try await repository.updateShift(
                scheduleId: schedule.id,
                shiftId: shift.id,
                action: action
            )
            try await refreshRequirementOccurrences()
            statusMessage = localized(
                "Schedule updated successfully.",
                "Расписание успешно обновлено."
            )
        } catch {
            errorMessage = error.localizedDescription
        }

        isUpdatingShift = false
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
            quantity: 1,
            startSlot: 16,
            endSlot: 24
        )
    }

    func makeRequirementDraft(for requirement: AppUnfilledRequirement) -> ScheduleRequirementEditorDraft {
        let occurrence = requirementOccurrencesById[requirement.id]

        return ScheduleRequirementEditorDraft(
            requirementId: requirement.id,
            date: requirement.date,
            positionId: occurrence?.positionId ?? requirement.positionId,
            quantity: occurrence?.quantity ?? max(1, requirement.missingStaff),
            startSlot: occurrence?.startSlot ?? max(0, requirement.startMinutes / 30),
            endSlot: occurrence?.endSlot ?? max((requirement.startMinutes / 30) + 1, requirement.endMinutes / 30)
        )
    }

    func saveRequirement(_ draft: ScheduleRequirementEditorDraft) async -> Bool {
        guard hasCompany else {
            errorMessage = localized("Create or join a company first.", "Сначала создайте компанию или присоединитесь к ней.")
            return false
        }

        guard let positionId = draft.positionId else {
            errorMessage = localized("Position is required.", "Выберите должность.")
            return false
        }

        isSavingRequirement = true
        errorMessage = nil
        statusMessage = nil

        do {
            let normalizedEndSlot = max(draft.endSlot, draft.startSlot + 1)

            if let requirementId = draft.requirementId {
                _ = try await requirementsRepository.updateRequirement(
                    id: requirementId,
                    date: draft.date,
                    branchId: nil,
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

            try await refreshCurrentSchedule()
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
            return
        }

        schedule = try await repository.fetchLatestSchedule(status: .draft)
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
}
