import Foundation
import UserNotifications

/// Thin wrapper around the system notification center. Delivers real
/// on-device notifications for events the poller detects; there is no
/// FCM/APNs server push, so this is the "push to phone" path that works
/// without any backend or push-certificate setup.
enum Notifier {

    /// Ask once for permission. Safe to call repeatedly — the system
    /// remembers the answer and won't re-prompt.
    static func requestPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { _, _ in }
    }

    /// Posts a local notification immediately. No-ops if permission was denied.
    static func notify(id: String, title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let request = UNNotificationRequest(identifier: id, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
}
