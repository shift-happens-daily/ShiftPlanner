import SwiftUI

struct RequirementFormView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var themeManager: ThemeManager
    @State private var draft: StaffingRequirementDraft

    let availablePositions: [RequirementPositionOption]
    let onCancel: () -> Void
    let onSave: (StaffingRequirementDraft) -> Bool

    init(
        draft: StaffingRequirementDraft,
        availablePositions: [RequirementPositionOption],
        onCancel: @escaping () -> Void,
        onSave: @escaping (StaffingRequirementDraft) -> Bool
    ) {
        _draft = State(initialValue: draft)
        self.availablePositions = availablePositions
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
                                    }
                                } else {
                                    draft.weekdays.insert(weekday)
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
                        allowedRange: 16...43
                    )

                    TimeSlotWheelPicker(
                        selection: endSlotBinding,
                        title: "To",
                        allowedRange: min(44, draft.startSlot + 1)...44
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
                            draft.endSlot = min(44, draft.startSlot + 1)
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
        }
    }

    private var previewText: String {
        let positionName = availablePositions.first(where: { $0.id == draft.positionId })?.name ?? "Role"
        let days = draft.weekdays.sorted().map(weekdayLabel(for:)).joined(separator: ", ")
        return "\(draft.quantity) \(positionName) needed on \(days) from \(slotToTime(draft.startSlot)) to \(slotToTime(max(draft.endSlot, draft.startSlot + 1)))."
    }

    private var startSlotBinding: Binding<Int> {
        Binding(
            get: { draft.startSlot },
            set: { newStartSlot in
                draft.startSlot = min(max(newStartSlot, 16), 43)
                if draft.endSlot <= draft.startSlot {
                    draft.endSlot = min(44, draft.startSlot + 1)
                }
            }
        )
    }

    private var endSlotBinding: Binding<Int> {
        Binding(
            get: { max(draft.endSlot, draft.startSlot + 1) },
            set: { newEndSlot in
                let minimumEndSlot = min(44, draft.startSlot + 1)
                draft.endSlot = min(max(newEndSlot, minimumEndSlot), 44)
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
}

private struct TimeSlotWheelPicker: View {
    @Binding var selection: Int
    let title: String
    let allowedRange: ClosedRange<Int>

    var body: some View {
        HStack {
            Text(title)

            Spacer()

            HStack(spacing: 0) {
                Picker(title, selection: hourBinding) {
                    ForEach(availableHours, id: \.self) { hour in
                        Text(String(format: "%02d", hour)).tag(hour)
                    }
                }
                .pickerStyle(.wheel)
                .frame(width: 72, height: 110)
                .clipped()

                Text(":")
                    .font(.title3.monospaced())
                    .fontWeight(.semibold)

                Picker(title, selection: minuteBinding) {
                    ForEach(availableMinutes, id: \.self) { minute in
                        Text(String(format: "%02d", minute)).tag(minute)
                    }
                }
                .pickerStyle(.wheel)
                .frame(width: 72, height: 110)
                .clipped()
            }
        }
    }

    private var availableHours: [Int] {
        Array(Set((allowedRange.lowerBound...allowedRange.upperBound).map { $0 / 2 })).sorted()
    }

    private var currentHour: Int {
        selection / 2
    }

    private var availableMinutes: [Int] {
        availableMinutes(for: currentHour)
    }

    private var hourBinding: Binding<Int> {
        Binding(
            get: { currentHour },
            set: { newHour in
                let preferredMinute = (selection % 2) * 30
                let minutes = availableMinutes(for: newHour)
                let chosenMinute = minutes.contains(preferredMinute) ? preferredMinute : (minutes.first ?? 0)
                selection = clampedSlot(hour: newHour, minute: chosenMinute)
            }
        )
    }

    private var minuteBinding: Binding<Int> {
        Binding(
            get: {
                let minute = (selection % 2) * 30
                return availableMinutes.contains(minute) ? minute : (availableMinutes.first ?? 0)
            },
            set: { newMinute in
                selection = clampedSlot(hour: currentHour, minute: newMinute)
            }
        )
    }

    private func availableMinutes(for hour: Int) -> [Int] {
        (allowedRange.lowerBound...allowedRange.upperBound)
            .filter { ($0 / 2) == hour }
            .map { ($0 % 2) * 30 }
    }

    private func clampedSlot(hour: Int, minute: Int) -> Int {
        let slot = (hour * 60 + minute) / 30
        return min(max(slot, allowedRange.lowerBound), allowedRange.upperBound)
    }
}
