import Combine
import SwiftUI

@MainActor
final class ThemeManager: ObservableObject {
    @Published var selectedTheme: AppTheme {
        didSet {
            UserDefaults.standard.set(selectedTheme.rawValue, forKey: themeKey)
        }
    }

    private let themeKey = "shiftplanner.selectedTheme"

    init() {
        let rawValue = UserDefaults.standard.string(forKey: themeKey)
        self.selectedTheme = AppTheme(rawValue: rawValue ?? "") ?? .light
    }
}
