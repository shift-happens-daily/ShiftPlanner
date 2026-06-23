import SwiftUI

struct ManagedEmployeeCardView: View {
    @EnvironmentObject private var themeManager: ThemeManager

    let employee: ManagedEmployee
    let branchTitle: String
    let positionTitle: String
    let isBranchPickerExpanded: Bool
    let isRolePickerExpanded: Bool
    let canDeleteEmployee: Bool
    let onToggleBranchPicker: () -> Void
    let onToggleRolePicker: () -> Void
    let onDelete: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            VStack(alignment: .leading, spacing: 10) {
                Text(employee.fullName)
                    .font(.headline)
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text(employee.email)
                    .font(.subheadline)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                    .lineLimit(1)
                    .truncationMode(.middle)

                HStack(alignment: .center, spacing: 8) {
                    badgeButton(
                        title: branchTitle,
                        systemImage: "building.2",
                        isExpanded: isBranchPickerExpanded,
                        action: onToggleBranchPicker
                    )

                    badgeButton(
                        title: positionTitle,
                        systemImage: "briefcase",
                        isExpanded: isRolePickerExpanded,
                        action: onToggleRolePicker
                    )
                }
                .padding(.trailing, canDeleteEmployee ? 38 : 0)
            }

            if canDeleteEmployee {
                Button {
                    onDelete()
                } label: {
                    Image(systemName: "xmark")
                        .font(.caption.weight(.semibold))
                        .frame(width: 12, height: 12)
                        .padding(7)
                        .foregroundStyle(themeManager.selectedTheme.accentColor)
                }
                .buttonStyle(.plain)
                .background(themeManager.selectedTheme.cardTint.opacity(0.85))
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(themeManager.selectedTheme.borderColor.opacity(0.7), lineWidth: 1)
                }
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .fixedSize()
            }
        }
        .padding(14)
        .themeCard()
    }

    private func badgeButton(
        title: String,
        systemImage: String,
        isExpanded: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: systemImage)
                    .font(.caption)
                Text(title)
                    .font(.subheadline)
                    .lineLimit(1)
                    .truncationMode(.tail)
                Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                    .font(.caption)
            }
            .frame(maxWidth: 144, alignment: .leading)
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(themeManager.selectedTheme.cardTint)
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
        .fixedSize()
    }
}
