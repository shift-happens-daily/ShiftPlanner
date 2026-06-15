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
            return "Can work"
        case .preferNotToWork:
            return "Prefer not"
        case .unavailable:
            return "Unavailable"
        }
    }

    var shortTitle: String {
        switch self {
        case .canWork:
            return "Can"
        case .preferNotToWork:
            return "Maybe"
        case .unavailable:
            return "Off"
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

    let timeSlots = Array(stride(from: 8 * 60, to: 22 * 60, by: 30))

    private var calendar: Calendar
    private var weekStorage: [Date: [[AvailabilityState]]] = [:]
    private var lastPaintedCell: AvailabilityGridCell?

    init(referenceDate: Date = Date()) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2
        self.calendar = calendar

        let weekStart = Self.startOfWeek(for: referenceDate, calendar: calendar)
        self.currentWeekStart = weekStart
        self.weekDates = Self.buildWeekDates(from: weekStart, calendar: calendar)
        self.weeklyStates = Self.makeDefaultWeek(slotCount: timeSlots.count)
        self.weekStorage[weekStart] = weeklyStates
    }

    var weekTitle: String {
        guard let lastDay = weekDates.last else { return "" }
        let startFormatter = DateFormatter()
        startFormatter.dateFormat = "MMM d"
        let endFormatter = DateFormatter()
        endFormatter.dateFormat = calendar.isDate(currentWeekStart, equalTo: lastDay, toGranularity: .month) ? "d" : "MMM d"
        return "\(startFormatter.string(from: currentWeekStart)) - \(endFormatter.string(from: lastDay))"
    }

    func shortDayLabel(for dayIndex: Int) -> String {
        guard weekDates.indices.contains(dayIndex) else { return "" }
        let formatter = DateFormatter()
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
        lastPaintedCell = cell
    }

    func endPainting() {
        lastPaintedCell = nil
    }

    func copyPreviousWeek() {
        guard let previousWeekStart = calendar.date(byAdding: .day, value: -7, to: currentWeekStart) else {
            return
        }

        let previousWeek = weekStorage[previousWeekStart] ?? Self.makeDefaultWeek(slotCount: timeSlots.count)
        weeklyStates = previousWeek
        weekStorage[currentWeekStart] = weeklyStates
    }

    func resetWeek() {
        weeklyStates = Self.makeDefaultWeek(slotCount: timeSlots.count)
        weekStorage[currentWeekStart] = weeklyStates
        lastPaintedCell = nil
    }

    private func moveWeek(by dayOffset: Int) {
        guard let newWeekStart = calendar.date(byAdding: .day, value: dayOffset, to: currentWeekStart) else {
            return
        }

        weekStorage[currentWeekStart] = weeklyStates

        currentWeekStart = newWeekStart
        weekDates = Self.buildWeekDates(from: newWeekStart, calendar: calendar)
        weeklyStates = weekStorage[newWeekStart] ?? Self.makeDefaultWeek(slotCount: timeSlots.count)
        weekStorage[newWeekStart] = weeklyStates
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
