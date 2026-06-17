import SwiftUI

struct RequirementsWeekSwitcherView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    let title: String
    let onPreviousWeek: () -> Void
    let onNextWeek: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button(action: onPreviousWeek) {
                Image(systemName: "chevron.left")
                    .font(.headline)
                    .frame(width: 40, height: 40)
                    .background(themeManager.selectedTheme.surfaceColor.opacity(0.92))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)

            Spacer()

            VStack(spacing: 4) {
                Text("Week")
                    .font(.caption)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                Text(title)
                    .font(.headline)
                    .fontWeight(.semibold)
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
            }

            Spacer()

            Button(action: onNextWeek) {
                Image(systemName: "chevron.right")
                    .font(.headline)
                    .frame(width: 40, height: 40)
                    .background(themeManager.selectedTheme.surfaceColor.opacity(0.92))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 12)
        .themeCard()
    }
}
