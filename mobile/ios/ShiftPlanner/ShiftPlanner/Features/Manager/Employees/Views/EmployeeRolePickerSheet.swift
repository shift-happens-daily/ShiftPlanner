import SwiftUI

struct EmployeeRolePickerSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var themeManager: ThemeManager

    let employee: ManagedEmployee
    let positions: [ManagedPosition]
    let currentPositionTitle: String
    let onAssignPosition: (UUID?) -> Void
    let onCreatePosition: (String) -> Void
    let onDeletePosition: (ManagedPosition) -> Void

    @State private var searchText = ""

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                TextField("Select an option or create one", text: $searchText)
                    .themeInputField()

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 10) {
                        if searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            pickerRow(
                                title: "No role",
                                subtitle: currentPositionTitle == "No role assigned" ? "Currently selected" : nil
                            ) {
                                onAssignPosition(nil)
                                dismiss()
                            }

                            ForEach(positions) { position in
                                pickerRow(
                                    title: position.title,
                                    subtitle: position.title == currentPositionTitle ? "Currently selected" : nil,
                                    trailingAction: {
                                        onDeletePosition(position)
                                        dismiss()
                                    }
                                ) {
                                    onAssignPosition(position.id)
                                    dismiss()
                                }
                            }
                        } else {
                            if !matchingPositions.isEmpty {
                                ForEach(matchingPositions) { position in
                                    pickerRow(
                                        title: position.title,
                                        subtitle: position.title == currentPositionTitle ? "Currently selected" : nil,
                                        trailingAction: {
                                            onDeletePosition(position)
                                            dismiss()
                                        }
                                    ) {
                                        onAssignPosition(position.id)
                                        dismiss()
                                    }
                                }
                            }

                            if shouldShowCreate {
                                Button {
                                    onCreatePosition(normalizedSearchText)
                                    dismiss()
                                } label: {
                                    HStack(spacing: 10) {
                                        Text("Create")
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
                        }
                    }
                }
            }
            .padding()
            .background(themeManager.selectedTheme.screenBackground)
            .navigationTitle(employee.fullName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private var normalizedSearchText: String {
        searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var matchingPositions: [ManagedPosition] {
        guard !normalizedSearchText.isEmpty else { return positions }
        return positions.filter {
            $0.title.localizedCaseInsensitiveContains(normalizedSearchText)
        }
    }

    private var shouldShowCreate: Bool {
        !normalizedSearchText.isEmpty &&
        positions.contains(where: { $0.title.caseInsensitiveCompare(normalizedSearchText) == .orderedSame }) == false
    }

    private func pickerRow(
        title: String,
        subtitle: String?,
        trailingAction: (() -> Void)? = nil,
        onTap: @escaping () -> Void
    ) -> some View {
        HStack(spacing: 10) {
            Button(action: onTap) {
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
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

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
        .background(themeManager.selectedTheme.elevatedSurfaceColor)
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
