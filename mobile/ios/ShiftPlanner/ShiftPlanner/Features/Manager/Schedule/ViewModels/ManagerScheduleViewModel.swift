import Foundation
import Combine

enum ScheduleShiftFilter: CaseIterable {
    case all
    case filled
    case unfilled

    var title: String {
        switch self {
        case .all: return localized("All", "Все")
        case .filled: return localized("Filled", "С сотрудником")
        case .unfilled: return localized("Unfilled", "Без сотрудника")
        }
    }
}

enum ScheduleCalendarEntry: Identifiable, Equatable {
    case shift(AppScheduledShift)
    case unfilled(AppUnfilledRequirement, index: Int)

    var id: String {
        switch self {
        case .shift(let shift): return "shift-\(shift.id)"
        case .unfilled(_, let index): return "unfilled-\(index)"
        }
    }

    var date: Date {
        switch self {
        case .shift(let shift): return shift.date
        case .unfilled(let requirement, _): return requirement.date
        }
    }

    var isFilled: Bool {
        if case .shift(let shift) = self { return shift.hasAssignedEmployee }
        return false
    }
}

/// An existing (draft/published) schedule that overlaps the period the user
/// tried to generate for. Shown in a resolution dialog: open it, or delete it
/// and regenerate.
struct ScheduleConflict: Identifiable, Equatable {
    let id = UUID()
    let scheduleId: Int
    let status: AppScheduleStatus
    let startDate: Date
    let endDate: Date
    let requestedStart: Date
    let requestedEnd: Date
    var requestedBranchId: Int?
}

@MainActor
final class ManagerScheduleViewModel: ObservableObject {
    // Displayed state
    @Published private(set) var schedule: AppSchedule?
    @Published private(set) var positions: [RequirementPositionOption] = []
    @Published private(set) var branches: [AppBranchOption] = []
    @Published private(set) var weekDates: [Date] = []
    @Published private(set) var weekLabel: String = ""
    @Published var filter: ScheduleShiftFilter = .all

    @Published var isLoading = false
    @Published var isGenerating = false
    @Published var isPublishing = false
    @Published var errorMessage: String?
    @Published var statusMessage: String?

    @Published private(set) var availableEmployees: [AppAvailableEmployee] = []
    @Published private(set) var loadingEmployees = false
    @Published var conflict: ScheduleConflict?

    private let scheduleRepository: ScheduleRepository
    private let requirementsRepository: RequirementsRepository
    private let employeeRepository: EmployeeManagementRepository
    private let hasCompany: Bool

    // The generation branch is chosen by where the period's requirements are;
    // defaultBranchId is only a fallback (first company branch).
    private var defaultBranchId: Int?
    private var weekOffset = 0
    private var didLoad = false
    private let calendar: Calendar

    init(
        user: AppUser,
        scheduleRepository: ScheduleRepository? = nil,
        requirementsRepository: RequirementsRepository? = nil,
        employeeRepository: EmployeeManagementRepository? = nil,
        referenceDate: Date = .now
    ) {
        self.scheduleRepository = scheduleRepository ?? APIScheduleRepository()
        self.requirementsRepository = requirementsRepository ?? APIRequirementsRepository()
        self.employeeRepository = employeeRepository
            ?? APIEmployeeManagementRepository(companyId: user.company?.id)
        self.hasCompany = user.hasCompany

        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2 // Monday
        self.calendar = calendar

        refreshWeek()
    }

    // MARK: - Derived state

    var canGenerate: Bool { hasCompany && !isGenerating && !isPublishing }
    var canPublish: Bool { hasCompany && schedule?.status == .draft && !isGenerating && !isPublishing }
    var hasSchedule: Bool { schedule != nil }

    var weekStart: Date { weekDates.first ?? calendar.startOfDay(for: .now) }
    var weekEnd: Date { weekDates.last ?? calendar.startOfDay(for: .now) }

    var scheduleTitle: String {
        guard let schedule else {
            return localized("No schedule for this week", "На этой неделе нет расписания")
        }
        return localized("Schedule #\(schedule.id)", "Расписание №\(schedule.id)") + " · " + schedule.status.title
    }

    func positionName(id: Int) -> String {
        positions.first(where: { $0.id == id })?.name
            ?? localized("Position #\(id)", "Должность №\(id)")
    }

    func shifts(on date: Date) -> [AppScheduledShift] {
        let day = calendar.startOfDay(for: date)
        return (schedule?.shifts ?? [])
            .filter { calendar.isDate($0.date, inSameDayAs: day) }
            .filter { shift in
                switch filter {
                case .all: return true
                case .filled: return shift.hasAssignedEmployee
                case .unfilled: return !shift.hasAssignedEmployee
                }
            }
            .sorted { $0.startMinutes < $1.startMinutes }
    }

    func unfilled(on date: Date) -> [AppUnfilledRequirement] {
        guard filter != .filled else { return [] }
        let day = calendar.startOfDay(for: date)
        return (schedule?.unfilledRequirements ?? [])
            .filter { calendar.isDate($0.date, inSameDayAs: day) }
            .sorted { $0.startMinutes < $1.startMinutes }
    }

    /// Unified entries for the calendar view — filled/unfilled shifts plus
    /// standalone unfilled requirements — honoring the active filter.
    var calendarEntries: [ScheduleCalendarEntry] {
        guard let schedule else { return [] }
        var entries: [ScheduleCalendarEntry] = []
        for shift in schedule.shifts {
            switch filter {
            case .all: entries.append(.shift(shift))
            case .filled: if shift.hasAssignedEmployee { entries.append(.shift(shift)) }
            case .unfilled: if !shift.hasAssignedEmployee { entries.append(.shift(shift)) }
            }
        }
        if filter != .filled {
            for (index, requirement) in schedule.unfilledRequirements.enumerated() {
                entries.append(.unfilled(requirement, index: index))
            }
        }
        return entries
    }

    // MARK: - Loading

    func loadIfNeeded() async {
        guard !didLoad else { return }
        didLoad = true
        await loadDictionaries()
        await loadLatestSchedule()
    }

    private func loadDictionaries() async {
        if let fetchedPositions = try? await requirementsRepository.fetchPositions() {
            positions = fetchedPositions
        }
        if let fetchedBranches = try? await employeeRepository.fetchBranches() {
            branches = fetchedBranches.map { AppBranchOption(id: $0.id, name: $0.name) }
            defaultBranchId = branches.first?.id
        }
    }

    func loadLatestSchedule() async {
        guard hasCompany else {
            schedule = nil
            statusMessage = localized(
                "Create or join a company first to generate schedules.",
                "Сначала создайте компанию или присоединитесь к ней, чтобы генерировать расписание."
            )
            return
        }
        isLoading = true
        errorMessage = nil
        do {
            let latest = try await scheduleRepository.fetchLatestSchedule(status: nil)
            schedule = latest
            // Jump to the schedule's own week so it is never "invisible"
            // (previously the tab always opened on the current week and an
            // off-week schedule looked like "no schedule").
            alignWeek(to: latest?.startDate)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    /// Manual refresh: someone may be editing the same data from the web app.
    /// Reloads the open schedule by id (falling back to the latest if it was
    /// deleted on the web side), plus the dictionaries.
    func refresh() async {
        await loadDictionaries()
        let currentId = schedule?.id
        isLoading = true
        errorMessage = nil
        do {
            if let currentId {
                if let reloaded = try? await scheduleRepository.fetchSchedule(scheduleId: currentId) {
                    schedule = reloaded
                } else {
                    schedule = try await scheduleRepository.fetchLatestSchedule(status: nil)
                }
            } else {
                schedule = try await scheduleRepository.fetchLatestSchedule(status: nil)
            }
            statusMessage = localized("Refreshed.", "Обновлено.")
            alignWeek(to: schedule?.startDate)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    // MARK: - Generation

    func generate(startDate: Date, endDate: Date, branchId: Int?) async {
        guard canGenerate else { return }
        await generateInternal(startDate: startDate, endDate: endDate, explicitBranchId: branchId)
    }

    private enum GenerationBranchChoice {
        case branch(Int?)
        case noRequirements
        case unknown
    }

    private func generateInternal(startDate: Date, endDate: Date, explicitBranchId: Int?) async {
        isGenerating = true
        errorMessage = nil
        statusMessage = nil

        // The backend solver only sees the requirements/employees of the branch
        // in the request, and it happily saves an EMPTY schedule when the period
        // has no requirements — which then blocks the period. So refuse to
        // generate when there are no requirements for the period.
        let choice = await resolveGenerationBranch(startDate: startDate, endDate: endDate, explicitBranchId: explicitBranchId)
        if case .noRequirements = choice {
            isGenerating = false
            if let explicitBranchId, let branchName = branchName(for: explicitBranchId) {
                errorMessage = localized(
                    "No requirements for \(branchName) in this period. Add requirements before generating.",
                    "Нет требований для «\(branchName)» в этом периоде. Добавьте требования перед генерацией."
                )
            } else {
                errorMessage = localized(
                    "No requirements in this period. Add requirements before generating.",
                    "В этом периоде нет требований. Добавьте требования перед генерацией."
                )
            }
            return
        }

        var targetBranchId: Int?
        if case let .branch(resolved) = choice {
            targetBranchId = resolved ?? explicitBranchId ?? defaultBranchId
        } else {
            targetBranchId = explicitBranchId ?? defaultBranchId
        }

        // Detect overlapping schedules up front and show a resolution dialog
        // instead of a dead-end 409.
        if var found = await findConflict(startDate: startDate, endDate: endDate, branchId: targetBranchId) {
            found.requestedBranchId = targetBranchId
            conflict = found
            isGenerating = false
            return
        }

        do {
            let schedules = try await scheduleRepository.generateSchedule(
                startDate: startDate,
                endDate: endDate,
                branchId: targetBranchId
            )
            if let first = schedules.first {
                schedule = first
            } else {
                // Some deployments return an empty payload; fall back to reading it back.
                schedule = try await scheduleRepository.fetchLatestSchedule(status: nil)
            }
            statusMessage = schedules.count > 1
                ? localized("Generated \(schedules.count) schedules.", "Сгенерировано расписаний: \(schedules.count).")
                : localized("Schedule generated successfully.", "Расписание успешно сгенерировано.")
            alignWeek(to: schedule?.startDate ?? startDate)
        } catch {
            // Race fallback: the conflicting schedule may have appeared between
            // the pre-check and the generate call (409 from the backend).
            if var late = await findConflict(startDate: startDate, endDate: endDate, branchId: targetBranchId) {
                late.requestedBranchId = targetBranchId
                conflict = late
            } else {
                errorMessage = error.localizedDescription
            }
        }
        isGenerating = false
    }

    /// Picks the branch to generate for based on where the period's requirements
    /// actually are. Requirements without a branch belong to the company's
    /// default (first) branch on the backend.
    private func resolveGenerationBranch(startDate: Date, endDate: Date, explicitBranchId: Int?) async -> GenerationBranchChoice {
        guard let requirements = try? await requirementsRepository.fetchRequirements(startDate: startDate, endDate: endDate) else {
            return .unknown // network error — don't block generation
        }
        if let explicitBranchId {
            // The user picked a branch — respect it, but refuse when the period
            // has no requirements for it (the backend would save an empty
            // schedule that then blocks the period).
            let hasDemand = requirements.contains { ($0.branchId ?? defaultBranchId) == explicitBranchId }
            return hasDemand ? .branch(explicitBranchId) : .noRequirements
        }
        if requirements.isEmpty {
            return .noRequirements
        }
        var branchesWithDemand: [Int?] = []
        for requirement in requirements {
            let resolved = requirement.branchId ?? defaultBranchId
            if !branchesWithDemand.contains(where: { $0 == resolved }) {
                branchesWithDemand.append(resolved)
            }
        }
        if branchesWithDemand.contains(where: { $0 == defaultBranchId }) {
            return .branch(defaultBranchId)
        }
        return .branch(branchesWithDemand.first ?? defaultBranchId)
    }

    private func findConflict(startDate: Date, endDate: Date, branchId: Int?) async -> ScheduleConflict? {
        guard let candidates = try? await scheduleRepository.fetchSchedules(
            startDate: startDate,
            endDate: endDate,
            branchId: branchId,
            status: nil
        ) else {
            return nil
        }
        let match = candidates.first { item in
            guard item.status != .archived else { return false }
            let branchOk = branchId == nil || item.branchId == nil || item.branchId == branchId
            // Defensive overlap check in case backend list-filter semantics differ.
            let overlaps = !(item.startDate > endDate) && !(item.endDate < startDate)
            return branchOk && overlaps
        }
        guard let match else { return nil }
        return ScheduleConflict(
            scheduleId: match.id,
            status: match.status,
            startDate: match.startDate,
            endDate: match.endDate,
            requestedStart: startDate,
            requestedEnd: endDate,
            requestedBranchId: branchId
        )
    }

    func dismissConflict() {
        conflict = nil
    }

    func openConflictingSchedule() async {
        guard let conflict else { return }
        self.conflict = nil
        isLoading = true
        errorMessage = nil
        do {
            let opened = try await scheduleRepository.fetchSchedule(scheduleId: conflict.scheduleId)
            schedule = opened
            alignWeek(to: opened.startDate)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func deleteConflictingAndRegenerate() async {
        guard let conflict else { return }
        self.conflict = nil
        isGenerating = true
        errorMessage = nil
        do {
            try await scheduleRepository.deleteSchedule(scheduleId: conflict.scheduleId)
        } catch {
            isGenerating = false
            errorMessage = error.localizedDescription
            return
        }
        isGenerating = false
        await generateInternal(
            startDate: conflict.requestedStart,
            endDate: conflict.requestedEnd,
            explicitBranchId: conflict.requestedBranchId
        )
    }

    // MARK: - Publish / delete

    func publish() async {
        guard let id = schedule?.id else { return }
        isPublishing = true
        errorMessage = nil
        do {
            schedule = try await scheduleRepository.publishSchedule(scheduleId: id)
            statusMessage = localized("Schedule published successfully.", "Расписание успешно опубликовано.")
        } catch {
            errorMessage = error.localizedDescription
        }
        isPublishing = false
    }

    func deleteSchedule() async {
        guard let id = schedule?.id else { return }
        do {
            try await scheduleRepository.deleteSchedule(scheduleId: id)
            schedule = nil
            statusMessage = localized("Schedule deleted.", "Расписание удалено.")
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Deleting a single week needs a concrete branch on the schedule.
    var canDeleteWeek: Bool { schedule?.branchId != nil }

    func deleteScheduleWeek() async {
        guard let branchId = schedule?.branchId else { return }
        do {
            try await scheduleRepository.deleteScheduleWeek(
                branchId: branchId,
                startDate: weekStart,
                endDate: weekEnd
            )
            statusMessage = localized("Week deleted.", "Неделя удалена.")
            await refresh()
        } catch {
            errorMessage = error.localizedDescription
        }
    }


    // MARK: - Shift CRUD

    func createShift(date: Date, positionId: Int, startMinutes: Int, endMinutes: Int) async -> Bool {
        guard let id = schedule?.id else { return false }
        guard endMinutes > startMinutes else {
            errorMessage = localized("End time must be after start time.", "Время окончания должно быть позже начала.")
            return false
        }
        do {
            schedule = try await scheduleRepository.createShift(
                scheduleId: id,
                mutation: ScheduleShiftMutation(
                    date: date, startMinutes: startMinutes, endMinutes: endMinutes,
                    positionId: positionId, employeeId: nil
                )
            )
            statusMessage = localized("Shift created.", "Смена создана.")
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func updateShift(shiftId: Int, date: Date, positionId: Int, startMinutes: Int, endMinutes: Int, employeeId: Int?) async -> Bool {
        guard let id = schedule?.id else { return false }
        guard endMinutes > startMinutes else {
            errorMessage = localized("End time must be after start time.", "Время окончания должно быть позже начала.")
            return false
        }
        do {
            schedule = try await scheduleRepository.updateShift(
                scheduleId: id,
                shiftId: shiftId,
                mutation: ScheduleShiftMutation(
                    date: date, startMinutes: startMinutes, endMinutes: endMinutes,
                    positionId: positionId, employeeId: employeeId
                )
            )
            statusMessage = localized("Shift updated.", "Смена обновлена.")
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func deleteShift(_ shift: AppScheduledShift) async {
        guard let id = schedule?.id else { return }
        do {
            schedule = try await scheduleRepository.deleteShift(scheduleId: id, shiftId: shift.id)
            statusMessage = localized("Shift removed.", "Смена удалена.")
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Assignment

    func loadAvailable(for shift: AppScheduledShift) async {
        guard let id = schedule?.id else { return }
        loadingEmployees = true
        do {
            availableEmployees = try await loadAssignable(scheduleId: id, shift: shift)
        } catch {
            errorMessage = error.localizedDescription
        }
        loadingEmployees = false
    }

    func loadAvailable(for requirement: AppUnfilledRequirement) async {
        guard let id = schedule?.id else { return }
        let fakeShift = AppScheduledShift(
            id: requirement.id, employeeId: nil, employeeName: nil,
            positionId: requirement.positionId, positionName: requirement.positionTitle,
            date: requirement.date, startMinutes: requirement.startMinutes, endMinutes: requirement.endMinutes
        )
        loadingEmployees = true
        do {
            availableEmployees = try await loadAssignable(scheduleId: id, shift: fakeShift)
        } catch {
            errorMessage = error.localizedDescription
        }
        loadingEmployees = false
    }

    /// Availability endpoint matches first (available → if-needed → unavailable),
    /// then EVERY other company employee, so a shift can always be assigned
    /// manually even when nobody fits the position/branch/availability filters.
    private func loadAssignable(scheduleId: Int, shift: AppScheduledShift) async throws -> [AppAvailableEmployee] {
        let fromAvailability = try await scheduleRepository
            .fetchAvailableEmployees(scheduleId: scheduleId, shift: shift, branchId: nil, includeUnavailable: true)
            .sorted { lhs, rhs in
                if lhs.availabilityStatus.sortRank == rhs.availabilityStatus.sortRank {
                    return lhs.fullName < rhs.fullName
                }
                return lhs.availabilityStatus.sortRank < rhs.availabilityStatus.sortRank
            }
        let knownIds = Set(fromAvailability.map { $0.id })
        let others = ((try? await employeeRepository.fetchEmployees()) ?? [])
            .filter { !knownIds.contains($0.id) }
            .sorted { $0.fullName < $1.fullName }
            .map { employee in
                AppAvailableEmployee(
                    id: employee.id,
                    fullName: employee.fullName,
                    positionName: employee.positionTitle ?? localized("No position", "Без должности"),
                    branchId: employee.branchId,
                    branchName: employee.branchName,
                    availabilityStatus: .unavailable,
                    assignedHours: 0
                )
            }
        return fromAvailability + others
    }

    func assignShift(shiftId: Int, employeeId: Int) async {
        guard let id = schedule?.id else { return }
        guard let existing = schedule?.shifts.first(where: { $0.id == shiftId }) else { return }
        do {
            schedule = try await scheduleRepository.updateShift(
                scheduleId: id,
                shiftId: shiftId,
                mutation: ScheduleShiftMutation(
                    date: existing.date, startMinutes: existing.startMinutes, endMinutes: existing.endMinutes,
                    positionId: existing.positionId, employeeId: employeeId
                )
            )
            availableEmployees = []
            statusMessage = localized("Employee assigned.", "Сотрудник назначен.")
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func assignRequirement(requirementId: Int, employeeId: Int) async {
        guard let id = schedule?.id else { return }
        do {
            schedule = try await scheduleRepository.assignRequirement(
                scheduleId: id, requirementId: requirementId, employeeId: employeeId
            )
            availableEmployees = []
            statusMessage = localized("Employee assigned.", "Сотрудник назначен.")
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func clearAvailable() {
        availableEmployees = []
    }

    /// True when [employee] belongs to a different branch than the open
    /// schedule — assigning them still works but is worth a heads-up.
    func isCrossBranch(_ employee: AppAvailableEmployee) -> Bool {
        guard let scheduleBranch = schedule?.branchId, let employeeBranch = employee.branchId else {
            return false
        }
        return scheduleBranch != employeeBranch
    }

    func clearMessages() {
        errorMessage = nil
        statusMessage = nil
    }

    // MARK: - Week navigation

    func previousWeek() {
        weekOffset -= 1
        refreshWeek()
    }

    func nextWeek() {
        weekOffset += 1
        refreshWeek()
    }

    private func alignWeek(to date: Date?) {
        guard let date else { return }
        let targetMonday = monday(of: date)
        let currentMonday = monday(of: .now)
        let days = calendar.dateComponents([.day], from: currentMonday, to: targetMonday).day ?? 0
        weekOffset = Int((Double(days) / 7.0).rounded(.down))
        refreshWeek()
    }

    private func refreshWeek() {
        let base = monday(of: .now)
        guard let start = calendar.date(byAdding: .day, value: weekOffset * 7, to: base) else { return }
        weekDates = (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: start) }
        weekLabel = Self.weekLabel(start: weekDates.first ?? start, end: weekDates.last ?? start)
    }

    private func monday(of date: Date) -> Date {
        let startOfDay = calendar.startOfDay(for: date)
        let weekday = calendar.component(.weekday, from: startOfDay) // 1=Sun ... 7=Sat
        let daysFromMonday = (weekday - calendar.firstWeekday + 7) % 7
        return calendar.date(byAdding: .day, value: -daysFromMonday, to: startOfDay) ?? startOfDay
    }

    private func branchName(for branchId: Int) -> String? {
        branches.first(where: { $0.id == branchId })?.name
    }

    private static func weekLabel(start: Date, end: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = LanguageManager.storedLocale
        formatter.dateFormat = "d MMM"
        return "\(formatter.string(from: start)) – \(formatter.string(from: end))"
    }

    // MARK: - CSV export

    /// Builds CSV from the current schedule (date, employee, position, times,
    /// hours, status), unfilled requirements appended as UNFILLED rows —
    /// mirrors Android's buildScheduleCsv.
    func buildScheduleCsv() -> String {
        guard let schedule else { return "" }

        let dateFormatter = DateFormatter()
        dateFormatter.calendar = Calendar(identifier: .gregorian)
        dateFormatter.locale = Locale(identifier: "en_US_POSIX")
        dateFormatter.dateFormat = "yyyy-MM-dd"

        var lines: [String] = ["Date,Employee,Position,Start,End,Hours,Status"]

        for shift in schedule.sortedShifts {
            let hours = Double(shift.endMinutes - shift.startMinutes) / 60.0
            lines.append([
                dateFormatter.string(from: shift.date),
                Self.csvEscape(shift.employeeName ?? "Unassigned"),
                Self.csvEscape(shift.positionName),
                Self.minutesToDisplay(shift.startMinutes),
                Self.minutesToDisplay(shift.endMinutes),
                String(format: "%.1f", hours),
                shift.hasAssignedEmployee ? "Assigned" : "Unassigned"
            ].joined(separator: ","))
        }

        for requirement in schedule.sortedUnfilledRequirements {
            let hours = Double(requirement.endMinutes - requirement.startMinutes) / 60.0
            for _ in 0..<max(1, requirement.missingStaff) {
                lines.append([
                    dateFormatter.string(from: requirement.date),
                    "UNFILLED",
                    Self.csvEscape(requirement.positionTitle),
                    Self.minutesToDisplay(requirement.startMinutes),
                    Self.minutesToDisplay(requirement.endMinutes),
                    String(format: "%.1f", hours),
                    "Unfilled"
                ].joined(separator: ","))
            }
        }

        return lines.joined(separator: "\n") + "\n"
    }

    private static func csvEscape(_ value: String) -> String {
        if value.contains(",") || value.contains("\"") || value.contains("\n") {
            return "\"" + value.replacingOccurrences(of: "\"", with: "\"\"") + "\""
        }
        return value
    }

    // MARK: - Time slot options (30-minute steps)

    static let minuteOptions: [Int] = (0..<48).map { $0 * 30 }

    static func minutesToDisplay(_ minutes: Int) -> String {
        String(format: "%02d:%02d", minutes / 60, minutes % 60)
    }
}
