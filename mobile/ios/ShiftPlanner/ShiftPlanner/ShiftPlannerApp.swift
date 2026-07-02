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

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(themeManager)
                .preferredColorScheme(themeManager.selectedTheme.preferredColorScheme)
                .tint(themeManager.selectedTheme.accentColor)
        }
    }
}
