import SwiftUI

enum AppTheme {
    case light
    case dark
    case dopamine

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
}
