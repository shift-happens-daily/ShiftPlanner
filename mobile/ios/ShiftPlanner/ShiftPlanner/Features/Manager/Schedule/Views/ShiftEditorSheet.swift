import SwiftUI

struct ShiftEditorSheet: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @Environment(\.dismiss) private var dismiss

    let shift: AppScheduledShift
    let recommendedEmployees: [AppAvailableEmployee]
    let employees: [ManagedEmployee]
    let isSubmitting: Bool
    let isLoadingRecommendedEmployees: Bool
    let canRemoveShift: Bool
    let onLoadRecommended: () async -> Void
    let onAssign: (Int) -> Void
    let onRemove: () -> Void

    @State private var searchText = ""
    @State private var isShowingDeleteConfirmation = false

    private var isAssignmentMode: Bool {
        !canRemoveShift && shift.employeeId == nil
    }

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

    private var filteredRecommendedEmployees: [AppAvailableEmployee] {
        guard !normalizedSearchText.isEmpty else { return recommendedEmployees }
        return recommendedEmployees.filter {
            $0.fullName.localizedCaseInsensitiveContains(normalizedSearchText) ||
            $0.positionName.localizedCaseInsensitiveContains(normalizedSearchText) ||
            ($0.branchName?.localizedCaseInsensitiveContains(normalizedSearchText) ?? false)
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
                        recommendedSection
                        fullEmployeesSection

                        if canRemoveShift {
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
                    }
                    .padding(.vertical, 4)
                }
            }
            .padding()
            .background(themeManager.selectedTheme.screenBackground.ignoresSafeArea())
            .navigationTitle(
                isAssignmentMode
                ? languageManager.text("Assign shift", "Назначить смену")
                : languageManager.text("Edit shift", "Редактировать смену")
            )
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await onLoadRecommended()
            }
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
            if canRemoveShift {
                Text(
                    languageManager.text(
                        "The shift will be removed from the schedule.",
                        "Смена будет удалена из расписания."
                    )
                )
            }
        }
    }

    @ViewBuilder
    private var recommendedSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(languageManager.text("Recommended / available", "Recommended / available"))
                .font(.footnote)
                .fontWeight(.semibold)
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

            if isLoadingRecommendedEmployees {
                HStack {
                    ProgressView()
                        .tint(themeManager.selectedTheme.accentColor)
                    Text(languageManager.text("Checking availability...", "Проверяю доступность..."))
                        .font(.footnote)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }
                .padding(.horizontal, 4)
                .padding(.vertical, 8)
            } else if filteredRecommendedEmployees.isEmpty {
                Text(languageManager.text("No recommended employees for this slot.", "Для этого слота нет рекомендуемых сотрудников."))
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 8)
            } else {
                ForEach(filteredRecommendedEmployees) { employee in
                    recommendedEmployeeRow(employee)
                }
            }
        }
    }

    @ViewBuilder
    private var fullEmployeesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(languageManager.text("All employees", "Все сотрудники"))
                .font(.footnote)
                .fontWeight(.semibold)
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

            ForEach(filteredEmployees) { employee in
                employeeRow(employee)
            }
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
                isAssignmentMode
                ? languageManager.text(
                    "Choose an employee for this unfilled shift. Recommended employees are shown first, but you can override manually.",
                    "Выберите сотрудника для этой незаполненной смены. Сначала показаны рекомендуемые сотрудники, но можно назначить любого вручную."
                )
                : languageManager.text(
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

    private func recommendedEmployeeRow(_ employee: AppAvailableEmployee) -> some View {
        return Button {
            onAssign(employee.id)
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(employee.fullName)
                        .font(.headline)
                        .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                    HStack(spacing: 8) {
                        Text(employee.availabilityStatus.title)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(themeManager.selectedTheme.accentColor)

                        Text(
                            languageManager.format(
                                "Assigned: %.1f h",
                                "Назначено: %.1f ч",
                                employee.assignedHours
                            )
                        )
                        .font(.caption)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                    }

                    Text(recommendedSubtitle(for: employee))
                        .font(.caption)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }

                Spacer()

                if isSubmitting {
                    ProgressView()
                        .tint(themeManager.selectedTheme.accentColor)
                } else {
                    Image(systemName: "sparkles")
                        .font(.title3)
                        .foregroundStyle(themeManager.selectedTheme.accentColor)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(themeManager.selectedTheme.cardTint)
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(themeManager.selectedTheme.accentColor.opacity(0.25), lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(isSubmitting)
        .opacity(isSubmitting ? 0.5 : 1)
    }

    private func employeeRow(_ employee: ManagedEmployee) -> some View {
        Button {
            onAssign(employee.id)
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

    private func recommendedSubtitle(for employee: AppAvailableEmployee) -> String {
        if let branchName = employee.branchName, !branchName.isEmpty {
            return "\(employee.positionName) • \(branchName)"
        }
        return employee.positionName
    }
}
