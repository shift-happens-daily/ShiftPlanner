import SwiftUI

struct ScheduleShiftEditorSheet: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @Environment(\.dismiss) private var dismiss

    @State private var draft: ScheduleShiftEditorDraft
    @State private var searchText = ""
    @State private var isShowingDeleteConfirmation = false

    let positions: [RequirementPositionOption]
    let employees: [ManagedEmployee]
    let recommendedEmployees: [AppAvailableEmployee]
    let isSubmitting: Bool
    let isLoadingRecommendedEmployees: Bool
    let onLoadRecommended: (ScheduleShiftEditorDraft) async -> Void
    let onSave: (ScheduleShiftEditorDraft) async -> Bool
    let onDelete: (ScheduleShiftEditorDraft) async -> Bool

    init(
        draft: ScheduleShiftEditorDraft,
        positions: [RequirementPositionOption],
        employees: [ManagedEmployee],
        recommendedEmployees: [AppAvailableEmployee],
        isSubmitting: Bool,
        isLoadingRecommendedEmployees: Bool,
        onLoadRecommended: @escaping (ScheduleShiftEditorDraft) async -> Void,
        onSave: @escaping (ScheduleShiftEditorDraft) async -> Bool,
        onDelete: @escaping (ScheduleShiftEditorDraft) async -> Bool
    ) {
        var normalizedDraft = draft

        if normalizedDraft.positionId.map({ $0 <= 0 }) ?? true {
            normalizedDraft.positionId = positions.first(where: { $0.id > 0 })?.id
        }

        if let employeeId = normalizedDraft.employeeId,
           employeeId <= 0 {
            normalizedDraft.employeeId = nil
        }

        _draft = State(initialValue: normalizedDraft)
        self.positions = positions
        self.employees = employees
        self.recommendedEmployees = recommendedEmployees
        self.isSubmitting = isSubmitting
        self.isLoadingRecommendedEmployees = isLoadingRecommendedEmployees
        self.onLoadRecommended = onLoadRecommended
        self.onSave = onSave
        self.onDelete = onDelete
    }

    private var normalizedSearchText: String {
        searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var hasValidPositionSelection: Bool {
        draft.positionId.map { $0 > 0 } ?? false
    }

    private var selectedPositionIdBinding: Binding<Int> {
        Binding(
            get: {
                if let positionId = draft.positionId, positionId > 0 {
                    return positionId
                }

                return positions.first(where: { $0.id > 0 })?.id ?? 0
            },
            set: { newValue in
                draft.positionId = newValue > 0 ? newValue : nil
                draft.positionName = positions.first(where: { $0.id == newValue })?.name
            }
        )
    }

    private var selectedEmployeeName: String {
        guard let employeeId = draft.employeeId,
              let employee = employees.first(where: { $0.id == employeeId }) else {
            return languageManager.text("Unassigned", "Не назначена")
        }
        return employee.fullName
    }

    private var filteredEmployees: [ManagedEmployee] {
        guard !normalizedSearchText.isEmpty else { return employees }
        return employees.filter {
            $0.fullName.localizedCaseInsensitiveContains(normalizedSearchText) ||
            $0.email.localizedCaseInsensitiveContains(normalizedSearchText) ||
            ($0.positionTitle?.localizedCaseInsensitiveContains(normalizedSearchText) ?? false) ||
            ($0.branchName?.localizedCaseInsensitiveContains(normalizedSearchText) ?? false)
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
            Form {
                Section(languageManager.text("Date", "Дата")) {
                    DatePicker(
                        "",
                        selection: $draft.date,
                        displayedComponents: .date
                    )
                    .labelsHidden()
                    .datePickerStyle(.compact)
                }

                Section(languageManager.text("Time", "Время")) {
                    TimeSlotWheelPicker(
                        selection: startSlotBinding,
                        title: languageManager.text("From", "С"),
                        allowedRange: 0...47
                    )

                    TimeSlotWheelPicker(
                        selection: endSlotBinding,
                        title: languageManager.text("To", "До"),
                        allowedRange: 1...48
                    )
                }

                Section(languageManager.text("Position", "Должность")) {
                    Picker(languageManager.text("Position", "Должность"), selection: selectedPositionIdBinding) {
                        ForEach(positions) { position in
                            Text(position.name).tag(position.id)
                        }
                    }
                }

                Section(languageManager.text("Assigned employee", "Назначенный сотрудник")) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(selectedEmployeeName)
                            .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                        Button(languageManager.text("Clear assignment", "Снять назначение")) {
                            draft.employeeId = nil
                        }
                        .disabled(isSubmitting || draft.employeeId == nil)
                    }
                }

                Section(languageManager.text("Employees", "Сотрудники")) {
                    TextField(languageManager.text("Search employee", "Найти сотрудника"), text: $searchText)
                        .textFieldStyle(.roundedBorder)

                    if isLoadingRecommendedEmployees {
                        ProgressView(languageManager.text("Checking availability...", "Проверяю доступность..."))
                            .tint(themeManager.selectedTheme.accentColor)
                    } else if !filteredRecommendedEmployees.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(languageManager.text("Recommended / available", "Recommended / available"))
                                .font(.footnote)
                                .fontWeight(.semibold)
                                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                            ForEach(filteredRecommendedEmployees) { employee in
                                employeeSelectionRow(
                                    id: employee.id,
                                    title: employee.fullName,
                                    subtitle: recommendedSubtitle(for: employee),
                                    trailingText: employee.availabilityStatus.title
                                )
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text(languageManager.text("All employees", "Все сотрудники"))
                            .font(.footnote)
                            .fontWeight(.semibold)
                            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                        if filteredEmployees.isEmpty {
                            Text(
                                languageManager.text(
                                    "No employees match your search.",
                                    "Поиск не нашел сотрудников."
                                )
                            )
                            .font(.footnote)
                            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        } else {
                            ForEach(filteredEmployees) { employee in
                                employeeSelectionRow(
                                    id: employee.id,
                                    title: employee.fullName,
                                    subtitle: employeeSubtitle(for: employee),
                                    trailingText: nil
                                )
                            }
                        }
                    }
                }

                if draft.isExistingShift {
                    Section {
                        Button(role: .destructive) {
                            isShowingDeleteConfirmation = true
                        } label: {
                            Text(languageManager.text("Delete shift", "Удалить смену"))
                        }
                        .disabled(isSubmitting)
                    }
                }
            }
            .navigationTitle(
                draft.isExistingShift
                ? languageManager.text("Edit shift", "Редактировать смену")
                : languageManager.text("Create shift", "Создать смену")
            )
            .navigationBarTitleDisplayMode(.inline)
            .onChange(of: draft.positionId) { _, newValue in
                if let newValue, newValue <= 0 {
                    draft.positionId = nil
                }
            }
            .task(id: draft.recommendationKey) {
                await onLoadRecommended(draft)
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(languageManager.text("Cancel", "Отмена")) {
                        dismiss()
                    }
                    .disabled(isSubmitting)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task {
                            if !hasValidPositionSelection,
                               let fallbackPositionId = positions.first(where: { $0.id > 0 })?.id {
                                draft.positionId = fallbackPositionId
                            }
                            let didSave = await onSave(draft)
                            if didSave {
                                dismiss()
                            }
                        }
                    } label: {
                        if isSubmitting {
                            ProgressView()
                                .tint(themeManager.selectedTheme.accentColor)
                        } else {
                            Text(languageManager.text("Save", "Сохранить"))
                        }
                    }
                    .disabled(isSubmitting || !hasValidPositionSelection)
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
                Task {
                    let didDelete = await onDelete(draft)
                    if didDelete {
                        dismiss()
                    }
                }
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

    private var startSlotBinding: Binding<Int> {
        Binding(
            get: { draft.startSlot },
            set: { newValue in
                draft.startSlot = min(max(newValue, 0), 47)
                if draft.endSlot <= draft.startSlot {
                    draft.endSlot = min(48, draft.startSlot + 1)
                }
            }
        )
    }

    private var endSlotBinding: Binding<Int> {
        Binding(
            get: { max(draft.endSlot, draft.startSlot + 1) },
            set: { newValue in
                draft.endSlot = min(max(newValue, draft.startSlot + 1), 48)
            }
        )
    }

    private func employeeSelectionRow(
        id: Int,
        title: String,
        subtitle: String,
        trailingText: String?
    ) -> some View {
        Button {
            draft.employeeId = id
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                    Text(subtitle)
                        .font(.footnote)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }

                Spacer()

                if let trailingText {
                    Text(trailingText)
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(themeManager.selectedTheme.accentColor)
                }

                if draft.employeeId == id {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(themeManager.selectedTheme.accentColor)
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(isSubmitting)
    }

    private func employeeSubtitle(for employee: ManagedEmployee) -> String {
        var parts: [String] = []

        if let positionTitle = employee.positionTitle, !positionTitle.isEmpty {
            parts.append(positionTitle)
        }

        if let branchName = employee.branchName, !branchName.isEmpty {
            parts.append(branchName)
        }

        if parts.isEmpty {
            parts.append(employee.email)
        } else {
            parts.append(employee.email)
        }

        return parts.joined(separator: " • ")
    }

    private func recommendedSubtitle(for employee: AppAvailableEmployee) -> String {
        var parts = [employee.positionName]
        if let branchName = employee.branchName, !branchName.isEmpty {
            parts.append(branchName)
        }
        parts.append(
            languageManager.format(
                "Assigned: %.1f h",
                "Назначено: %.1f ч",
                employee.assignedHours
            )
        )
        return parts.joined(separator: " • ")
    }
}
