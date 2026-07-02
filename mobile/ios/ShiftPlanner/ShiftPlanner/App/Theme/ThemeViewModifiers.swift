import SwiftUI

struct ThemeCardModifier: ViewModifier {
    @EnvironmentObject private var themeManager: ThemeManager

    func body(content: Content) -> some View {
        content
            .background(themeManager.selectedTheme.elevatedSurfaceColor)
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

struct ThemeInputModifier: ViewModifier {
    @EnvironmentObject private var themeManager: ThemeManager

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(themeManager.selectedTheme.fieldColor)
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

struct ThemePrimaryActionModifier: ViewModifier {
    @EnvironmentObject private var themeManager: ThemeManager
    let isEnabled: Bool

    func body(content: Content) -> some View {
        content
            .font(.headline)
            .fontWeight(.semibold)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .foregroundStyle(themeManager.selectedTheme.primaryActionTextColor)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(isEnabled ? themeManager.selectedTheme.primaryActionFillColor : themeManager.selectedTheme.secondaryTextColor.opacity(0.45))
            )
    }
}

struct ThemeSecondaryActionModifier: ViewModifier {
    @EnvironmentObject private var themeManager: ThemeManager

    func body(content: Content) -> some View {
        content
            .font(.headline)
            .fontWeight(.semibold)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .foregroundStyle(themeManager.selectedTheme.accentColor)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(themeManager.selectedTheme.cardTint)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(themeManager.selectedTheme.accentColor.opacity(0.22), lineWidth: 1)
            }
    }
}

extension View {
    func themeCard() -> some View {
        modifier(ThemeCardModifier())
    }

    func themeInputField() -> some View {
        modifier(ThemeInputModifier())
    }

    func themePrimaryAction(isEnabled: Bool = true) -> some View {
        modifier(ThemePrimaryActionModifier(isEnabled: isEnabled))
    }

    func themeSecondaryAction() -> some View {
        modifier(ThemeSecondaryActionModifier())
    }
}
