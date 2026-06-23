import SwiftUI

struct RequirementsWorkingHoursRowView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @State private var isEditing = false

    let weekdayLabel: String
    let workingHours: DayWorkingHours
    let onUpdate: (Int, Int) -> Void

    var body: some View {
        Button {
            isEditing = true
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(weekdayLabel) " + languageManager.text("working hours", "часы работы"))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                    Text(languageManager.text("Used for new requirements", "Используется для новых требований"))
                        .font(.caption)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }

                Spacer()

                Text("\(slotLabel(for: workingHours.startSlot))–\(slotLabel(for: workingHours.endSlot))")
                    .font(.subheadline.monospaced())
                    .fontWeight(.semibold)
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                Image(systemName: "slider.horizontal.3")
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.accentColor)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .themeCard()
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $isEditing) {
            WorkingHoursPickerSheet(
                weekdayLabel: weekdayLabel,
                workingHours: workingHours,
                onApply: onUpdate
            )
        }
    }

    private func slotLabel(for slot: Int) -> String {
        let totalMinutes = slot * 30
        let hour = totalMinutes / 60
        let minutes = totalMinutes % 60
        return String(format: "%02d:%02d", hour, minutes)
    }
}

private struct WorkingHoursPickerSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var languageManager: LanguageManager
    @State private var startSlot: Int
    @State private var endSlot: Int

    let weekdayLabel: String
    let onApply: (Int, Int) -> Void

    init(
        weekdayLabel: String,
        workingHours: DayWorkingHours,
        onApply: @escaping (Int, Int) -> Void
    ) {
        _startSlot = State(initialValue: workingHours.startSlot)
        _endSlot = State(initialValue: Self.workingValue(workingHours))
        self.weekdayLabel = weekdayLabel
        self.onApply = onApply
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("\(weekdayLabel) " + languageManager.text("shift range", "рабочий диапазон")) {
                    TimeSlotWheelPicker(
                        selection: startSlotBinding,
                        title: languageManager.text("From", "С"),
                        allowedRange: 0...43
                    )

                    TimeSlotWheelPicker(
                        selection: endSlotBinding,
                        title: languageManager.text("To", "До"),
                        allowedRange: min(44, startSlot + 1)...44
                    )
                }
            }
            .navigationTitle(languageManager.text("Working Hours", "Рабочие часы"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(languageManager.text("Cancel", "Отмена")) {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button(languageManager.text("Apply", "Применить")) {
                        onApply(startSlot, max(endSlot, startSlot + 1))
                        dismiss()
                    }
                }
            }
        }
    }

    private var startSlotBinding: Binding<Int> {
        Binding(
            get: { startSlot },
            set: { newStartSlot in
                startSlot = min(max(newStartSlot, 0), 43)
                if endSlot <= startSlot {
                    endSlot = min(44, startSlot + 1)
                }
            }
        )
    }

    private var endSlotBinding: Binding<Int> {
        Binding(
            get: { max(endSlot, startSlot + 1) },
            set: { newEndSlot in
                let minimumEndSlot = min(44, startSlot + 1)
                endSlot = min(max(newEndSlot, minimumEndSlot), 44)
            }
        )
    }

    private static func workingValue(_ workingHours: DayWorkingHours) -> Int {
        max(workingHours.endSlot, workingHours.startSlot + 1)
    }
}
