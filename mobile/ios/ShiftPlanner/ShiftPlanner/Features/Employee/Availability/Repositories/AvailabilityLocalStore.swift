import Foundation

protocol AvailabilityLocalStore {
    func loadWeeks(employeeId: Int) -> [Date: [[AvailabilityState]]]
    func saveWeeks(_ weeks: [Date: [[AvailabilityState]]], employeeId: Int)
    func clearWeeks(employeeId: Int)
}

final class UserDefaultsAvailabilityLocalStore: AvailabilityLocalStore {
    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let calendar = Calendar(identifier: .gregorian)

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func loadWeeks(employeeId: Int) -> [Date: [[AvailabilityState]]] {
        guard let data = defaults.data(forKey: storageKey(employeeId: employeeId)),
              let payload = try? decoder.decode(StoredAvailabilityPayload.self, from: data) else {
            return [:]
        }

        var result: [Date: [[AvailabilityState]]] = [:]
        let formatter = Self.weekFormatter

        for week in payload.weeks {
            guard let date = formatter.date(from: week.weekStart) else { continue }
            result[date] = week.states
        }

        return result
    }

    func saveWeeks(_ weeks: [Date: [[AvailabilityState]]], employeeId: Int) {
        let formatter = Self.weekFormatter
        let payload = StoredAvailabilityPayload(
            weeks: weeks
                .sorted { $0.key < $1.key }
                .map { date, states in
                    StoredAvailabilityWeek(
                        weekStart: formatter.string(from: date),
                        states: states
                    )
                }
        )

        guard let data = try? encoder.encode(payload) else { return }
        defaults.set(data, forKey: storageKey(employeeId: employeeId))
    }

    func clearWeeks(employeeId: Int) {
        defaults.removeObject(forKey: storageKey(employeeId: employeeId))
    }

    private func storageKey(employeeId: Int) -> String {
        "shiftplanner.availability.local.\(employeeId)"
    }

    private static let weekFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

private struct StoredAvailabilityPayload: Codable {
    let weeks: [StoredAvailabilityWeek]
}

private struct StoredAvailabilityWeek: Codable {
    let weekStart: String
    let states: [[AvailabilityState]]
}
