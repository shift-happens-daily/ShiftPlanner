import Foundation

enum AppLanguage: String, CaseIterable, Identifiable {
    case english = "en"
    case russian = "ru"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .english:
            return "ENG"
        case .russian:
            return "RUS"
        }
    }

    var localeIdentifier: String {
        switch self {
        case .english:
            return "en_US"
        case .russian:
            return "ru_RU"
        }
    }
}
