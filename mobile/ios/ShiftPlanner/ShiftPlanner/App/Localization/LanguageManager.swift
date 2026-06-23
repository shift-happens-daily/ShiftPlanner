import Combine
import Foundation

@MainActor
final class LanguageManager: ObservableObject {
    static let shared = LanguageManager()
    nonisolated private static let languageKey = "shiftplanner.selectedLanguage"

    @Published var selectedLanguage: AppLanguage {
        didSet {
            UserDefaults.standard.set(selectedLanguage.rawValue, forKey: Self.languageKey)
        }
    }

    var locale: Locale {
        Locale(identifier: selectedLanguage.localeIdentifier)
    }

    private init() {
        self.selectedLanguage = Self.storedLanguage()
    }

    func text(_ english: String, _ russian: String) -> String {
        switch selectedLanguage {
        case .english:
            return english
        case .russian:
            return russian
        }
    }

    func format(_ english: String, _ russian: String, _ arguments: CVarArg...) -> String {
        let format = text(english, russian)
        return String(format: format, locale: locale, arguments: arguments)
    }

    nonisolated static var storedLocale: Locale {
        let identifier: String

        switch storedLanguage() {
        case .english:
            identifier = "en_US"
        case .russian:
            identifier = "ru_RU"
        }

        return Locale(identifier: identifier)
    }

    nonisolated static func storedLanguage() -> AppLanguage {
        let rawValue = UserDefaults.standard.string(forKey: languageKey)
        return AppLanguage(rawValue: rawValue ?? "") ?? .english
    }

    nonisolated static func localizedFormat(_ english: String, _ russian: String, _ arguments: CVarArg...) -> String {
        let format = localized(english, russian)
        return String(format: format, locale: storedLocale, arguments: arguments)
    }

    nonisolated static func localized(_ english: String, _ russian: String) -> String {
        switch storedLanguage() {
        case .english:
            return english
        case .russian:
            return russian
        }
    }
}

func localized(_ english: String, _ russian: String) -> String {
    LanguageManager.localized(english, russian)
}
