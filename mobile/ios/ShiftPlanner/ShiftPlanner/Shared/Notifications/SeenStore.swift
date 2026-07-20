import Foundation

/// Records which items the poller has already surfaced, so each event fires a
/// phone notification only once. Backed by UserDefaults.
///
/// On the first poll after login/install we record baselines WITHOUT
/// notifying, to avoid a burst of notifications for pre-existing data.
struct SeenStore {
    static let roleEmployee = "employee"
    static let roleManager = "manager"

    static let keyShifts = "notif_shift_ids"
    static let keyExchange = "notif_exchange_ids"
    static let keyEmployeeRequests = "notif_emp_req_ids"
    static let keyManagerRequests = "notif_mgr_req_ids"
    static let keyTimeOff = "notif_timeoff_ids"

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func isInitialized(role: String) -> Bool {
        defaults.bool(forKey: "notif_init_\(role)")
    }

    func markInitialized(role: String) {
        defaults.set(true, forKey: "notif_init_\(role)")
    }

    func lastScheduleId() -> Int {
        defaults.object(forKey: "notif_schedule_id") as? Int ?? -1
    }

    func setLastScheduleId(_ id: Int) {
        defaults.set(id, forKey: "notif_schedule_id")
    }

    func seenIds(key: String) -> Set<String> {
        Set(defaults.stringArray(forKey: key) ?? [])
    }

    /// Returns the ids in `current` not previously seen under `key`, and
    /// records the new baseline.
    func diffAndStore(key: String, current: Set<String>) -> Set<String> {
        let previous = seenIds(key: key)
        defaults.set(Array(current), forKey: key)
        return current.subtracting(previous)
    }
}
