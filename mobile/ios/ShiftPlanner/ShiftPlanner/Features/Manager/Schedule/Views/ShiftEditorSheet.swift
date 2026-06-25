import SwiftUI

struct ShiftEditorSheet: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @Environment(\.dismiss) private var dismiss

    let shift: AppScheduledShift
    let employees: [ManagedEmployee]
    let isSubmitting: Bool
    let onAssign: (ManagedEmployee) -> Void
    let onRemove: () -> Void

    @State private var searchText = ""
    @State private var isShowingDeleteConfirmation = false

    private var normalizedSearchText: String {
        searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var filteredEmployees: [ManagedEmployee] {
        guard !normalizedSearchText.isEmpty else { return employees }
        return employees.filter {
            $0.fullName.localizedCaseInsensitiveContains(normalizedSearchText) ||
            $0.email.localizedCaseInsensitiveContains(normalizedSearchText) ||
            ($0.positionTitle?.localizedCaseInsensitiveContains(normalizedSearchText) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                summaryCard

                TextField(languageManager.text("Search employee", "Найти сотрудника"), text: $searchText)
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

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(filteredEmployees) { employee in
                            employeeRow(employee)
                        }

                        Button(role: .destructive) {
                            isShowingDeleteConfirmation = true
                        } label: {
                            HStack {
                                Image(systemName: "trash")
                                Text(languageManager.text("Remove shift", "Удалить смену"))
                                Spacer()
                            }
                            .font(.headline)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(themeManager.selectedTheme.cardTint)
                            .overlay {
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .stroke(themeManager.selectedTheme.destructiveColor.opacity(0.25), lineWidth: 1)
                            }
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(themeManager.selectedTheme.destructiveColor)
                        .disabled(isSubmitting)
                        .opacity(isSubmitting ? 0.5 : 1)
                    }
                    .padding(.vertical, 4)
                }
            }
            .padding()
            .background(themeManager.selectedTheme.screenBackground.ignoresSafeArea())
            .navigationTitle(languageManager.text("Edit shift", "Редактировать смену"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(languageManager.text("Close", "Закрыть")) {
                        dismiss()
                    }
                }
            }
        }
        .interactiveDismissDisabled(isSubmitting)
        .confirmationDialog(
            languageManager.text("Delete this shift?", "Удалить эту смену?"),
            isPresented: $isShowingDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button(languageManager.text("Delete", "Удалить"), role: .destructive) {
                onRemove()
            }
            Button(languageManager.text("Cancel", "Отмена"), role: .cancel) {}
        } message: {
            Text(
                languageManager.text(
                    "The shift will be removed from the schedule.",
                    "Смена будет удалена из расписания."
                )
            )
        }
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(shift.positionName)
                .font(.headline)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            Text("\(formattedDate(shift.date)) • \(formattedTimeRange)")
                .font(.subheadline)
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

            Text(
                languageManager.text(
                    "Select any employee to reassign this shift. Availability is not checked here.",
                    "Выберите любого сотрудника, чтобы переназначить смену. Доступность здесь не проверяется."
                )
            )
            .font(.footnote)
            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .themeCard()
    }

    private func employeeRow(_ employee: ManagedEmployee) -> some View {
        Button {
            onAssign(employee)
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(employee.fullName)
                        .font(.headline)
                        .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                    Text(employee.email)
                        .font(.caption)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                    if let positionTitle = employee.positionTitle, !positionTitle.isEmpty {
                        Text(positionTitle)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(themeManager.selectedTheme.accentColor)
                    }
                }

                Spacer()

                if isSubmitting {
                    ProgressView()
                        .tint(themeManager.selectedTheme.accentColor)
                } else {
                    Image(systemName: "arrow.right.circle")
                        .font(.title3)
                        .foregroundStyle(themeManager.selectedTheme.accentColor)
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
        .buttonStyle(.plain)
        .disabled(isSubmitting)
        .opacity(isSubmitting ? 0.5 : 1)
    }

    private func formattedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = languageManager.locale
        formatter.dateFormat = "EEEE, d MMM"
        return formatter.string(from: date)
    }

    private var formattedTimeRange: String {
        "\(formattedTime(shift.startMinutes)) - \(formattedTime(shift.endMinutes))"
    }

    private func formattedTime(_ minutes: Int) -> String {
        let hour = minutes / 60
        let minute = minutes % 60
        return String(format: "%02d:%02d", hour, minute)
    }
}
