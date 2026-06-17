import SwiftUI

struct RequirementFormView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var themeManager: ThemeManager
    @State private var draft: StaffingRequirementDraft

    let availablePositions: [RequirementPositionOption]
    let workingHoursByWeekday: [Int: DayWorkingHours]
    let onCancel: () -> Void
    let onSave: (StaffingRequirementDraft) -> Bool

    init(
        draft: StaffingRequirementDraft,
        availablePositions: [RequirementPositionOption],
        workingHoursByWeekday: [Int: DayWorkingHours],
        onCancel: @escaping () -> Void,
        onSave: @escaping (StaffingRequirementDraft) -> Bool
    ) {
        _draft = State(initialValue: draft)
        self.availablePositions = availablePositions
        self.workingHoursByWeekday = workingHoursByWeekday
        self.onCancel = onCancel
        self.onSave = onSave
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Position") {
                    Picker("Role", selection: $draft.positionId) {
                        ForEach(availablePositions) { position in
                            Text(position.name).tag(Optional(position.id))
                        }
                    }
                }

                if draft.editingRequirementId == nil {
                    Section("Days") {
                        ForEach(0..<7, id: \.self) { weekday in
                            let isSelected = draft.weekdays.contains(weekday)
                            Button {
                                if isSelected {
                                    if draft.weekdays.count > 1 {
                                        draft.weekdays.remove(weekday)
                                        clampDraftToAllowedRange()
                                    }
                                } else {
                                    draft.weekdays.insert(weekday)
                                    clampDraftToAllowedRange()
                                }
                            } label: {
                                HStack {
                                    Text(weekdayLabel(for: weekday))
                                    Spacer()
                                    if isSelected {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(themeManager.selectedTheme.accentColor)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Section("Demand") {
                    Stepper(value: $draft.quantity, in: 1...20) {
                        Text("Quantity: \(draft.quantity)")
                    }
                }

                Section("Time") {
                    TimeSlotWheelPicker(
                        selection: startSlotBinding,
                        title: "From",
                        allowedRange: startAllowedRange
                    )

                    TimeSlotWheelPicker(
                        selection: endSlotBinding,
                        title: "To",
                        allowedRange: endAllowedRange
                    )
                }

                Section("Preview") {
                    Text(previewText)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }
            }
            .navigationTitle(draft.editingRequirementId == nil ? "Add Requirement" : "Edit Requirement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        onCancel()
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        if draft.endSlot <= draft.startSlot {
                            draft.endSlot = min(timeRange.endSlot, draft.startSlot + 1)
                        }

                        let didSave = onSave(draft)

                        if didSave {
                            dismiss()
                        }
                    } label: {
                        Text("Save")
                    }
                    .disabled(draft.positionId == nil || draft.weekdays.isEmpty)
                }
            }
            .onAppear {
                clampDraftToAllowedRange()
            }
        }
    }

    private var previewText: String {
        let positionName = availablePositions.first(where: { $0.id == draft.positionId })?.name ?? "Role"
        let days = draft.weekdays.sorted().map(weekdayLabel(for:)).joined(separator: ", ")
        return "\(draft.quantity) \(positionName) needed on \(days) from \(slotToTime(draft.startSlot)) to \(slotToTime(max(draft.endSlot, draft.startSlot + 1)))."
    }

    private var timeRange: DayWorkingHours {
        let days = draft.weekdays.isEmpty ? [0] : draft.weekdays.sorted()
        let ranges = days.map { workingHoursByWeekday[$0] ?? DayWorkingHours(startSlot: 16, endSlot: 36) }

        let overlappingStart = ranges.map(\.startSlot).max() ?? 16
        let overlappingEnd = ranges.map(\.endSlot).min() ?? 36

        if overlappingEnd > overlappingStart {
            return DayWorkingHours(startSlot: overlappingStart, endSlot: overlappingEnd)
        }

        let fallbackStart = ranges.first?.startSlot ?? 16
        let fallbackEnd = min(44, max(ranges.first?.endSlot ?? 36, fallbackStart + 1))
        return DayWorkingHours(startSlot: fallbackStart, endSlot: fallbackEnd)
    }

    private var startAllowedRange: ClosedRange<Int> {
        timeRange.startSlot...max(timeRange.startSlot, timeRange.endSlot - 1)
    }

    private var endAllowedRange: ClosedRange<Int> {
        min(timeRange.endSlot, draft.startSlot + 1)...timeRange.endSlot
    }

    private var startSlotBinding: Binding<Int> {
        Binding(
            get: { draft.startSlot },
            set: { newStartSlot in
                draft.startSlot = min(
                    max(newStartSlot, timeRange.startSlot),
                    max(timeRange.startSlot, timeRange.endSlot - 1)
                )
                if draft.endSlot <= draft.startSlot {
                    draft.endSlot = min(timeRange.endSlot, draft.startSlot + 1)
                }
            }
        )
    }

    private var endSlotBinding: Binding<Int> {
        Binding(
            get: { max(draft.endSlot, draft.startSlot + 1) },
            set: { newEndSlot in
                let minimumEndSlot = min(timeRange.endSlot, draft.startSlot + 1)
                draft.endSlot = min(max(newEndSlot, minimumEndSlot), timeRange.endSlot)
            }
        )
    }

    private func slotToTime(_ slot: Int) -> String {
        let totalMinutes = slot * 30
        let hour = totalMinutes / 60
        let minutes = totalMinutes % 60
        return String(format: "%02d:%02d", hour, minutes)
    }

    private func weekdayLabel(for weekday: Int) -> String {
        ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][weekday]
    }

    private func clampDraftToAllowedRange() {
        draft.startSlot = min(
            max(draft.startSlot, timeRange.startSlot),
            max(timeRange.startSlot, timeRange.endSlot - 1)
        )
        draft.endSlot = min(
            max(draft.endSlot, draft.startSlot + 1),
            timeRange.endSlot
        )
    }
}
