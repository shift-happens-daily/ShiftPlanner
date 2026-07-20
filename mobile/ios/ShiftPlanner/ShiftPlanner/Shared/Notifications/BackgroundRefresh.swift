import Foundation
import BackgroundTasks

/// Registers and schedules the background-refresh task that runs
/// `NotificationPoller` while the app is closed.
///
/// The task only activates when the app has the Background Modes capability
/// with our identifier listed in `BGTaskSchedulerPermittedIdentifiers`
/// (Xcode → target → Signing & Capabilities → Background Modes → Background
/// fetch). Without it, everything here safely no-ops — foreground polling
/// still works — instead of crashing on an unpermitted identifier.
enum BackgroundRefresh {

    static let taskIdentifier = "com.froggyriia.ShiftPlanner.refresh"

    /// True when the Info.plist permits our background task identifier.
    static var isSupported: Bool {
        let permitted = Bundle.main.object(forInfoDictionaryKey: "BGTaskSchedulerPermittedIdentifiers") as? [String]
        return permitted?.contains(taskIdentifier) == true
    }

    /// Must be called before the app finishes launching (App.init).
    static func registerIfSupported() {
        guard isSupported else { return }
        BGTaskScheduler.shared.register(forTaskWithIdentifier: taskIdentifier, using: nil) { task in
            handle(task: task)
        }
    }

    /// Call when the app moves to the background.
    static func scheduleIfSupported() {
        guard isSupported else { return }
        let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
        // iOS decides the actual cadence; this is the earliest we'd like.
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    private static func handle(task: BGTask) {
        // Chain the next refresh before doing the work.
        scheduleIfSupported()

        let poll = Task {
            await NotificationPoller.poll()
            task.setTaskCompleted(success: true)
        }
        task.expirationHandler = {
            poll.cancel()
            task.setTaskCompleted(success: false)
        }
    }
}
