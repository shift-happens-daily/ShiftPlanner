import Foundation
import Combine
import SwiftUI

enum AvailabilityState: String, CaseIterable, Identifiable, Codable {
    case canWork
    case preferNotToWork
    case unavailable

    var id: String { rawValue }

    var title: String {
        switch self {
        case .canWork:
            return localized("Can work", "Могу")
        case .preferNotToWork:
            return localized("Prefer not", "Нежелательно")
        case .unavailable:
            return localized("Unavailable", "Не могу")
        }
    }

    var shortTitle: String {
        switch self {
        case .canWork:
            return localized("Can", "Да")
        case .preferNotToWork:
            return localized("Maybe", "Можно")
        case .unavailable:
            return localized("Off", "Нет")
        }
    }

    var fillColor: Color {
        switch self {
        case .canWork:
            return Color.green.opacity(0.75)
        case .preferNotToWork:
            return Color.orange.opacity(0.75)
        case .unavailable:
            return Color.gray.opacity(0.28)
        }
    }

    var borderColor: Color {
        switch self {
        case .canWork:
            return Color.green.opacity(0.95)
        case .preferNotToWork:
            return Color.orange.opacity(0.95)
        case .unavailable:
            return Color.gray.opacity(0.45)
        }
    }
}

struct AvailabilityGridCell: Hashable {
    let dayIndex: Int
    let slotIndex: Int
}

@MainActor
final class AvailabilityViewModel: ObservableObject {
    @Published private(set) var currentWeekStart: Date
    @Published private(set) var weeklyStates: [[AvailabilityState]]
    @Published private(set) var weekDates: [Date]
    @Published var selectedState: AvailabilityState = .canWork
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var errorMessage: String?
    @Published var statusMessage: String?
    @Published private(set) var backendSyncNote: String?

    let timeSlots = Array(stride(from: 8 * 60, to: 22 * 60, by: 30))

    private var calendar: Calendar
    private var weekStorage: [Date: [[AvailabilityState]]] = [:]
    private var remoteTemplateStates: [[AvailabilityState]]
    private var locallyStoredWeekStarts: Set<Date> = []
    private var lastPaintedCell: AvailabilityGridCell?
    private let employeeId: Int?
    private let repository: AvailabilityRepository
    private let localStore: AvailabilityLocalStore
    private var hasLoadedRemoteAvailability = false

    init(
        referenceDate: Date = Date(),
        employeeId: Int?,
        repository: AvailabilityRepository,
        localStore: AvailabilityLocalStore? = nil
    ) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2
        self.calendar = calendar
        self.employeeId = employeeId
        self.repository = repository
        self.localStore = localStore ?? UserDefaultsAvailabilityLocalStore()

        let weekStart = Self.startOfWeek(for: referenceDate, calendar: calendar)
        let defaultWeek = Self.makeDefaultWeek(slotCount: timeSlots.count)
        self.currentWeekStart = weekStart
        self.weekDates = Self.buildWeekDates(from: weekStart, calendar: calendar)
        self.weeklyStates = defaultWeek
        self.remoteTemplateStates = defaultWeek

        if let employeeId {
            let storedWeeks = self.localStore.loadWeeks(employeeId: employeeId)
            if let storedCurrentWeek = storedWeeks[weekStart] {
                self.weeklyStates = storedCurrentWeek
            }
            self.weekStorage = storedWeeks
            self.locallyStoredWeekStarts = Set(storedWeeks.keys)
        }

        self.weekStorage[weekStart] = self.weekStorage[weekStart] ?? self.weeklyStates
    }

    var canSave: Bool {
        employeeId != nil && !isSaving && !isLoading
    }

    var weekTitle: String {
        guard let lastDay = weekDates.last else { return "" }
        let startFormatter = DateFormatter()
        startFormatter.locale = LanguageManager.storedLocale
        startFormatter.dateFormat = "MMM d"
        let endFormatter = DateFormatter()
        endFormatter.locale = LanguageManager.storedLocale
        endFormatter.dateFormat = calendar.isDate(currentWeekStart, equalTo: lastDay, toGranularity: .month) ? "d" : "MMM d"
        return "\(startFormatter.string(from: currentWeekStart)) - \(endFormatter.string(from: lastDay))"
    }

    func shortDayLabel(for dayIndex: Int) -> String {
        guard weekDates.indices.contains(dayIndex) else { return "" }
        let formatter = DateFormatter()
        formatter.locale = LanguageManager.storedLocale
        formatter.dateFormat = "EEE"
        return formatter.string(from: weekDates[dayIndex]).uppercased()
    }

    func dayNumberLabel(for dayIndex: Int) -> String {
        guard weekDates.indices.contains(dayIndex) else { return "" }
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: weekDates[dayIndex])
    }

    func timeLabel(for slotIndex: Int) -> String {
        guard timeSlots.indices.contains(slotIndex) else { return "" }
        let minutes = timeSlots[slotIndex]
        let hour = minutes / 60
        let minute = minutes % 60

        guard minute == 0 else { return "" }
        return "\(hour):00"
    }

    func isHalfHourSlot(_ slotIndex: Int) -> Bool {
        guard timeSlots.indices.contains(slotIndex) else { return false }
        return timeSlots[slotIndex] % 60 != 0
    }

    func state(forDayIndex dayIndex: Int, slotIndex: Int) -> AvailabilityState {
        guard weeklyStates.indices.contains(slotIndex),
              weeklyStates[slotIndex].indices.contains(dayIndex) else {
            return .unavailable
        }
        return weeklyStates[slotIndex][dayIndex]
    }

    func selectState(_ state: AvailabilityState) {
        selectedState = state
    }

    func goToPreviousWeek() {
        moveWeek(by: -7)
    }

    func goToNextWeek() {
        moveWeek(by: 7)
    }

    func beginPainting() {
        lastPaintedCell = nil
    }

    func paint(dayIndex: Int, slotIndex: Int) {
        guard weeklyStates.indices.contains(slotIndex),
              weeklyStates[slotIndex].indices.contains(dayIndex) else {
            return
        }

        let cell = AvailabilityGridCell(dayIndex: dayIndex, slotIndex: slotIndex)
        guard cell != lastPaintedCell else { return }

        let currentState = weeklyStates[slotIndex][dayIndex]
        weeklyStates[slotIndex][dayIndex] = currentState == selectedState ? .unavailable : selectedState
        weekStorage[currentWeekStart] = weeklyStates
        persistLocallyIfPossible()
        lastPaintedCell = cell
    }

    func endPainting() {
        lastPaintedCell = nil
    }

    func loadAvailability() async {
        guard !hasLoadedRemoteAvailability else { return }
        hasLoadedRemoteAvailability = true

        guard let employeeId else {
            statusMessage = localized("Availability can be saved after joining a company.", "Сохранение доступности появится после присоединения к компании.")
            return
        }

        isLoading = true
        errorMessage = nil
        statusMessage = nil

        do {
            let response = try await repository.fetchAvailability(employeeId: employeeId)
            applyAvailabilityResponse(response)
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func saveAvailability() async {
        guard let employeeId else {
            errorMessage = localized("Availability can be saved after joining a company.", "Сохранение доступности появится после присоединения к компании.")
            return
        }

        isSaving = true
        errorMessage = nil
        statusMessage = nil

        do {
            let payload = buildUpsertPayload()
            _ = try await repository.saveAvailability(employeeId: employeeId, payload: payload)
            weekStorage[currentWeekStart] = weeklyStates
            localStore.saveWeeks(weekStorage, employeeId: employeeId)
            statusMessage = localized(
                "Availability saved. 'Prefer not' stays only on this device until the backend supports it.",
                "Доступность сохранена. 'Нежелательно' пока хранится только на этом устройстве, пока бэкенд это не поддерживает."
            )
        } catch {
            errorMessage = error.localizedDescription
        }

        isSaving = false
    }

    func copyPreviousWeek() {
        guard let previousWeekStart = calendar.date(byAdding: .day, value: -7, to: currentWeekStart) else {
            return
        }

        let previousWeek = weekStorage[previousWeekStart] ?? Self.makeDefaultWeek(slotCount: timeSlots.count)
        weeklyStates = previousWeek
        weekStorage[currentWeekStart] = weeklyStates
        persistLocallyIfPossible()
    }

    func resetWeek() {
        weeklyStates = Self.makeDefaultWeek(slotCount: timeSlots.count)
        weekStorage[currentWeekStart] = weeklyStates
        lastPaintedCell = nil
        persistLocallyIfPossible()
        statusMessage = localized(
            "This week was cleared locally. Tap Save to overwrite the shared weekly availability on the backend.",
            "Эта неделя очищена локально. Нажмите Сохранить, чтобы перезаписать общее недельное расписание на бэкенде."
        )
        errorMessage = nil
    }

    private func moveWeek(by dayOffset: Int) {
        guard let newWeekStart = calendar.date(byAdding: .day, value: dayOffset, to: currentWeekStart) else {
            return
        }

        weekStorage[currentWeekStart] = weeklyStates

        currentWeekStart = newWeekStart
        weekDates = Self.buildWeekDates(from: newWeekStart, calendar: calendar)
        weeklyStates = weekStorage[newWeekStart] ?? remoteTemplateStates
        weekStorage[newWeekStart] = weeklyStates
        persistLocallyIfPossible()
    }

    private func applyAvailabilityResponse(_ response: EmployeeAvailabilityResponseDTO) {
        var restoredWeek = Self.makeDefaultWeek(slotCount: timeSlots.count)

        for block in response.weeklyAvailability {
            let startMinutes = minutes(from: block.startTime)
            let endMinutes = minutes(from: block.endTime)

            guard let startSlot = slotIndex(for: startMinutes),
                  let endSlot = slotBoundaryIndex(for: endMinutes),
                  (0..<7).contains(block.weekday),
                  startSlot < endSlot else {
                continue
            }

            for slotIndex in startSlot..<endSlot {
                restoredWeek[slotIndex][block.weekday] = .canWork
            }
        }

        remoteTemplateStates = restoredWeek

        if locallyStoredWeekStarts.contains(currentWeekStart) {
            weeklyStates = weekStorage[currentWeekStart] ?? restoredWeek
            weekStorage[currentWeekStart] = weeklyStates
        } else {
            weeklyStates = restoredWeek
            weekStorage[currentWeekStart] = restoredWeek
        }

        backendSyncNote = localized(
            "Can work syncs with the server. 'Prefer not' is stored only on this device for now.",
            "'Могу' синхронизируется с сервером. 'Нежелательно' пока хранится только на этом устройстве."
        )
    }

    private func buildUpsertPayload() -> EmployeeAvailabilityUpsertDTO {
        var blocks: [EmployeeAvailabilityBlockDTO] = []

        for dayIndex in 0..<7 {
            let dayStates = weeklyStates.map { $0[dayIndex] }

            var activeStartSlot: Int?

            for slotIndex in 0...dayStates.count {
                let state: AvailabilityState? = slotIndex < dayStates.count ? dayStates[slotIndex] : nil
                let isAvailable = state == .canWork

                if isAvailable {
                    if activeStartSlot == nil {
                        activeStartSlot = slotIndex
                    }
                } else if let startSlot = activeStartSlot {
                    blocks.append(
                        EmployeeAvailabilityBlockDTO(
                            weekday: dayIndex,
                            startTime: timeString(forSlotBoundary: startSlot),
                            endTime: timeString(forSlotBoundary: slotIndex)
                        )
                    )
                    activeStartSlot = nil
                }
            }
        }

        return EmployeeAvailabilityUpsertDTO(
            weeklyAvailability: blocks,
            desiredDaysOff: []
        )
    }

    private func applyServerCompatibleStates(from states: [[AvailabilityState]]) -> [[AvailabilityState]] {
        states.map { row in
            row.map { state in
                state == .canWork ? .canWork : .unavailable
            }
        }
    }

    private func persistLocallyIfPossible() {
        guard let employeeId else { return }
        locallyStoredWeekStarts = Set(weekStorage.keys)
        localStore.saveWeeks(weekStorage, employeeId: employeeId)
    }

    private func minutes(from timeString: String) -> Int {
        let parts = timeString.split(separator: ":").compactMap { Int($0) }
        guard parts.count >= 2 else { return 0 }
        return (parts[0] * 60) + parts[1]
    }

    private func slotIndex(for minutes: Int) -> Int? {
        let baseMinutes = timeSlots.first ?? 0
        let offset = minutes - baseMinutes
        guard offset >= 0, offset % 30 == 0 else { return nil }
        let index = offset / 30
        return timeSlots.indices.contains(index) ? index : nil
    }

    private func slotBoundaryIndex(for minutes: Int) -> Int? {
        let baseMinutes = timeSlots.first ?? 0
        let offset = minutes - baseMinutes
        guard offset >= 0, offset % 30 == 0 else { return nil }
        let index = offset / 30
        return (0...timeSlots.count).contains(index) ? index : nil
    }

    private func timeString(forSlotBoundary slotBoundary: Int) -> String {
        let baseMinutes = timeSlots.first ?? 0
        let minutes = baseMinutes + slotBoundary * 30
        let hour = minutes / 60
        let minute = minutes % 60
        return String(format: "%02d:%02d:00", hour, minute)
    }

    private static func startOfWeek(for date: Date, calendar: Calendar) -> Date {
        let components = calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        return calendar.date(from: components) ?? date
    }

    private static func buildWeekDates(from weekStart: Date, calendar: Calendar) -> [Date] {
        (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: weekStart) }
    }

    private static func makeDefaultWeek(slotCount: Int) -> [[AvailabilityState]] {
        Array(
            repeating: Array(repeating: .unavailable, count: 7),
            count: slotCount
        )
    }
}
