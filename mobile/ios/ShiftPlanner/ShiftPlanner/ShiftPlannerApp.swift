//
//  ShiftPlannerApp.swift
//  ShiftPlanner
//
//  Created by Виктория on 11.06.2026.
//

import SwiftUI

@main
struct ShiftPlannerApp: App {
    @StateObject private var themeManager = ThemeManager()
    @StateObject private var languageManager = LanguageManager.shared
    @Environment(\.scenePhase) private var scenePhase

    init() {
        // Must happen before launch finishes; no-ops without the
        // Background Modes capability.
        BackgroundRefresh.registerIfSupported()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(themeManager)
                .environmentObject(languageManager)
                .task {
                    Notifier.requestPermission()
                }
        }
        .onChange(of: scenePhase) { _, newPhase in
            switch newPhase {
            case .active:
                // Foreground poll: diffs against the seen-store and raises
                // notifications for anything that appeared while away.
                Task { await NotificationPoller.poll() }
            case .background:
                BackgroundRefresh.scheduleIfSupported()
            default:
                break
            }
        }
    }
}
