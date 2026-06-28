import SwiftUI

struct ScheduleRequirementEditorSheet: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @Environment(\.dismiss) private var dismiss

    @State private var draft: ScheduleRequirementEditorDraft

    let availablePositions: [RequirementPositionOption]
    let isSubmitting: Bool
    let onSave: (ScheduleRequirementEditorDraft) async -> Bool

    init(
        draft: ScheduleRequirementEditorDraft,
        availablePositions: [RequirementPositionOption],
        isSubmitting: Bool,
        onSave: @escaping (ScheduleRequirementEditorDraft) async -> Bool
    ) {
        var normalizedDraft = draft
        if normalizedDraft.positionId.map({ $0 <= 0 }) ?? true {
            normalizedDraft.positionId = availablePositions.first(where: { $0.id > 0 })?.id
        }
        if normalizedDraft.positionName == nil,
           let positionId = normalizedDraft.positionId {
            normalizedDraft.positionName = availablePositions.first(where: { $0.id == positionId })?.name
        }

        _draft = State(initialValue: normalizedDraft)
        self.availablePositions = availablePositions
        self.isSubmitting = isSubmitting
        self.onSave = onSave
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

                return availablePositions.first(where: { $0.id > 0 })?.id ?? 0
            },
            set: { newValue in
                draft.positionId = newValue > 0 ? newValue : nil
                draft.positionName = availablePositions.first(where: { $0.id == newValue })?.name
            }
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(languageManager.text("Day", "День")) {
                    Text(formattedDate(draft.date))
                        .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                }

                Section(languageManager.text("Position", "Должность")) {
                    Picker(languageManager.text("Role", "Роль"), selection: selectedPositionIdBinding) {
                        ForEach(availablePositions) { position in
                            Text(position.name).tag(position.id)
                        }
                    }
                }

                Section(languageManager.text("Demand", "Потребность")) {
                    Stepper(value: $draft.quantity, in: 1...20) {
                        Text(languageManager.format(
                            "Employees needed: %d",
                            "Нужно сотрудников: %d",
                            draft.quantity
                        ))
                    }
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
            }
            .navigationTitle(
                draft.requirementId == nil
                ? languageManager.text("Add shift", "Добавить смену")
                : languageManager.text("Edit shift", "Изменить смену")
            )
            .navigationBarTitleDisplayMode(.inline)
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

    private func formattedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = languageManager.locale
        formatter.dateFormat = "EEEE, d MMM"
        return formatter.string(from: date)
    }
}
