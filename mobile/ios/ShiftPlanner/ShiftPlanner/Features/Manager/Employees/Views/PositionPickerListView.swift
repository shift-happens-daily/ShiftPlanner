import SwiftUI

struct PositionPickerListView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager

    let positions: [ManagedPosition]
    let currentPositionTitle: String
    let canAssignPosition: Bool
    let canDeletePosition: Bool
    let onAssignPosition: (Int?) -> Void
    let onCreatePosition: (String) -> Void
    let onDeletePosition: (ManagedPosition) -> Void

    @State private var searchText = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField(languageManager.text("Select an option or create one", "Выберите вариант или создайте новый"), text: $searchText)
                .font(.subheadline)
                .textFieldStyle(.plain)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(themeManager.selectedTheme.screenBackground)
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
                }
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                if normalizedSearchText.isEmpty {
                    pickerRow(
                        title: languageManager.text("No role", "Без должности"),
                        subtitle: currentPositionTitle == localized("No role assigned", "Без должности")
                            ? languageManager.text("Currently selected", "Выбрано сейчас")
                            : nil
                    ) {
                        if canAssignPosition {
                            onAssignPosition(nil)
                        }
                    }

                    ForEach(positions) { position in
                        pickerRow(
                            title: position.title,
                            subtitle: position.title == currentPositionTitle
                                ? languageManager.text("Currently selected", "Выбрано сейчас")
                                : nil,
                            trailingAction: canDeletePosition ? {
                                onDeletePosition(position)
                            } : nil
                        ) {
                            if canAssignPosition {
                                onAssignPosition(position.id)
                            }
                        }
                    }
                } else {
                    ForEach(matchingPositions) { position in
                        pickerRow(
                            title: position.title,
                            subtitle: position.title == currentPositionTitle
                                ? languageManager.text("Currently selected", "Выбрано сейчас")
                                : nil,
                            trailingAction: canDeletePosition ? {
                                onDeletePosition(position)
                            } : nil
                        ) {
                            if canAssignPosition {
                                onAssignPosition(position.id)
                            }
                        }
                    }

                    if shouldShowCreate {
                        createRow
                    }
                }
            }

            Spacer(minLength: 0)
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var normalizedSearchText: String {
        searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var matchingPositions: [ManagedPosition] {
        guard !normalizedSearchText.isEmpty else { return positions }
        return positions.filter { $0.title.localizedCaseInsensitiveContains(normalizedSearchText) }
    }

    private var shouldShowCreate: Bool {
        !normalizedSearchText.isEmpty &&
        positions.contains(where: { $0.title.caseInsensitiveCompare(normalizedSearchText) == .orderedSame }) == false
    }

    private var createRow: some View {
        Button {
            onCreatePosition(normalizedSearchText)
        } label: {
            HStack(spacing: 10) {
                Text(languageManager.text("Create", "Создать"))
                    .fontWeight(.semibold)
                Text(normalizedSearchText)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(themeManager.selectedTheme.cardTint)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(themeManager.selectedTheme.elevatedSurfaceColor)
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
    }

    private func pickerRow(
        title: String,
        subtitle: String?,
        trailingAction: (() -> Void)? = nil,
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

            if let trailingAction {
                Button(action: trailingAction) {
                    Image(systemName: "xmark")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(themeManager.selectedTheme.accentColor)
                        .frame(width: 28, height: 28)
                        .background(themeManager.selectedTheme.cardTint)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
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
