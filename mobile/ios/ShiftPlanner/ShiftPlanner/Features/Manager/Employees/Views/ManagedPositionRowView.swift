import SwiftUI

struct ManagedPositionRowView: View {
    @EnvironmentObject private var themeManager: ThemeManager

    let position: ManagedPosition
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Text(position.title)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            Spacer()

            Button("Delete") {
                onDelete()
            }
            .buttonStyle(.plain)
            .foregroundStyle(themeManager.selectedTheme.accentColor)
            .font(.subheadline)
            .fontWeight(.semibold)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .themeCard()
    }
}
