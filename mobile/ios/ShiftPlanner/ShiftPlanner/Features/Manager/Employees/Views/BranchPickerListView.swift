import SwiftUI

struct BranchPickerListView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager

    let branches: [ManagedBranch]
    let currentBranchTitle: String
    let onAssignBranch: (Int?) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            pickerRow(
                title: languageManager.text("No branch", "Без филиала"),
                subtitle: currentBranchTitle == localized("No branch", "Без филиала")
                    ? languageManager.text("Currently selected", "Выбрано сейчас")
                    : nil
            ) {
                onAssignBranch(nil)
            }

            ForEach(branches) { branch in
                pickerRow(
                    title: branch.name,
                    subtitle: branch.name == currentBranchTitle
                        ? languageManager.text("Currently selected", "Выбрано сейчас")
                        : nil
                ) {
                    onAssignBranch(branch.id)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private func pickerRow(
        title: String,
        subtitle: String?,
        onTap: @escaping () -> Void
    ) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                if let subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .onTapGesture {
            onTap()
        }
        .background(themeManager.selectedTheme.elevatedSurfaceColor)
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
