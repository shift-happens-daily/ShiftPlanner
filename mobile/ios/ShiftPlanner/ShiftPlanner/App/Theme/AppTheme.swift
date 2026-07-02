import SwiftUI

enum AppTheme: String, CaseIterable, Identifiable {
    case light
    case dark
    case dopamine

    var id: String { rawValue }

    var title: String {
        switch self {
        case .light:
            return "Light"
        case .dark:
            return "Dark"
        case .dopamine:
            return "Dopamine"
        }
    }

    var preferredColorScheme: ColorScheme? {
        switch self {
        case .light, .dopamine:
            return .light
        case .dark:
            return .dark
        }
    }

    var gradientColors: [Color] {
        switch self {
        case .light:
            return [
                Color("LightPrimary"),
                Color("LightSecondary"),
                Color("LightAccent")
            ]

        case .dark:
            return [
                Color("DarkPrimary"),
                Color("DarkSecondary"),
                Color("DarkAccent")
            ]

        case .dopamine:
            return [
                Color("DophaminePrimary"),
                Color("DophamineSecondary"),
                Color("DophamineAccent"),
                Color("DophamineAdditional")
            ]
        }
    }

    var accentColor: Color {
        switch self {
        case .light:
            return Color("LightAccent")
        case .dark:
            return Color("DarkAccent")
        case .dopamine:
            return Color("DophamineAccent")
        }
    }

    var primaryActionFillColor: Color {
        switch self {
        case .light:
            return Color(red: 0.12, green: 0.18, blue: 0.30)
        case .dark:
            return Color(red: 0.83, green: 0.90, blue: 1.0)
        case .dopamine:
            return Color(red: 1.0, green: 0.86, blue: 0.50)
        }
    }

    var primaryActionTextColor: Color {
        switch self {
        case .light:
            return .white
        case .dark, .dopamine:
            return Color(red: 0.09, green: 0.11, blue: 0.16)
        }
    }

    var secondaryAccentColor: Color {
        switch self {
        case .light:
            return Color("LightSecondary")
        case .dark:
            return Color("DarkSecondary")
        case .dopamine:
            return Color("DophamineSecondary")
        }
    }

    var screenBackground: Color {
        switch self {
        case .light:
            return Color(red: 0.97, green: 0.98, blue: 1.0)
        case .dark:
            return Color(red: 0.07, green: 0.09, blue: 0.12)
        case .dopamine:
            return Color(red: 1.0, green: 0.97, blue: 0.92)
        }
    }

    var surfaceColor: Color {
        switch self {
        case .light:
            return .white
        case .dark:
            return Color(red: 0.12, green: 0.15, blue: 0.20)
        case .dopamine:
            return Color(red: 1.0, green: 0.99, blue: 0.96)
        }
    }

    var elevatedSurfaceColor: Color {
        switch self {
        case .light:
            return Color.white.opacity(0.9)
        case .dark:
            return Color(red: 0.16, green: 0.19, blue: 0.25)
        case .dopamine:
            return Color(red: 1.0, green: 0.95, blue: 0.88)
        }
    }

    var cardTint: Color {
        switch self {
        case .light:
            return Color("LightPrimary").opacity(0.08)
        case .dark:
            return Color("DarkAccent").opacity(0.20)
        case .dopamine:
            return Color("DophaminePrimary").opacity(0.18)
        }
    }

    var fieldColor: Color {
        switch self {
        case .light:
            return .white
        case .dark:
            return Color(red: 0.15, green: 0.18, blue: 0.24)
        case .dopamine:
            return Color(red: 1.0, green: 0.99, blue: 0.95)
        }
    }

    var primaryTextColor: Color {
        switch self {
        case .light, .dopamine:
            return Color(red: 0.09, green: 0.11, blue: 0.16)
        case .dark:
            return Color(red: 0.93, green: 0.95, blue: 0.98)
        }
    }

    var secondaryTextColor: Color {
        switch self {
        case .light:
            return Color(red: 0.41, green: 0.46, blue: 0.55)
        case .dark:
            return Color(red: 0.63, green: 0.69, blue: 0.78)
        case .dopamine:
            return Color(red: 0.46, green: 0.37, blue: 0.39)
        }
    }

    var borderColor: Color {
        switch self {
        case .light:
            return Color.black.opacity(0.08)
        case .dark:
            return Color.white.opacity(0.10)
        case .dopamine:
            return Color("DophamineAccent").opacity(0.22)
        }
    }

    var destructiveColor: Color {
        switch self {
        case .light, .dopamine:
            return Color(red: 0.88, green: 0.27, blue: 0.32)
        case .dark:
            return Color(red: 1.0, green: 0.42, blue: 0.44)
        }
    }
}
