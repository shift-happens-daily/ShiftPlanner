import SwiftUI

struct ManagedEmployeeCardView: View {
    @EnvironmentObject private var themeManager: ThemeManager

    let employee: ManagedEmployee
    let positionTitle: String
    let onOpenRolePicker: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(employee.fullName)
                    .font(.headline)
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                    .lineLimit(2)

                Text(employee.email)
                    .font(.subheadline)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 10) {
                Button {
                    onOpenRolePicker()
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "briefcase")
                            .font(.caption)
                        Text(positionTitle)
                            .font(.subheadline)
                            .lineLimit(1)
                            .truncationMode(.tail)
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.caption)
                    }
                    .frame(maxWidth: 140, alignment: .leading)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 9)
                    .background(themeManager.selectedTheme.cardTint)
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                .fixedSize(horizontal: false, vertical: true)

                Button {
                    onDelete()
                } label: {
                    Image(systemName: "xmark")
                        .font(.caption.weight(.bold))
                        .frame(width: 14, height: 14)
                        .padding(9)
                        .foregroundStyle(themeManager.selectedTheme.accentColor)
                }
                .buttonStyle(.plain)
                .background(themeManager.selectedTheme.cardTint)
                .overlay {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
                }
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .fixedSize()
            }
        }
        .padding(14)
        .themeCard()
    }
}
