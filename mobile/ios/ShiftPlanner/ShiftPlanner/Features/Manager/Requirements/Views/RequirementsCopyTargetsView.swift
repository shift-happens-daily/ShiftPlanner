import SwiftUI

struct RequirementsCopyTargetsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @State private var selectedTargets: Set<Int>

    let sourceWeekday: Int
    let labels: [String]
    let onCopy: (Set<Int>) -> Void

    init(
        sourceWeekday: Int,
        labels: [String],
        onCopy: @escaping (Set<Int>) -> Void
    ) {
        self.sourceWeekday = sourceWeekday
        self.labels = labels
        self.onCopy = onCopy
        _selectedTargets = State(initialValue: [])
    }

    var body: some View {
        NavigationStack {
            List {
                Section(languageManager.text("Copy from", "Копировать из")) {
                    Text(labels[sourceWeekday])
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }

                Section(languageManager.text("Copy to", "Копировать в")) {
                    ForEach(Array(labels.enumerated()), id: \.offset) { index, label in
                        if index != sourceWeekday {
                            Button {
                                if selectedTargets.contains(index) {
                                    selectedTargets.remove(index)
                                } else {
                                    selectedTargets.insert(index)
                                }
                            } label: {
                                HStack {
                                    Text(label)
                                    Spacer()
                                    if selectedTargets.contains(index) {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(themeManager.selectedTheme.accentColor)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Section {
                    Text(languageManager.text("Existing requirements on selected target days will be replaced with the copied ones.", "Существующие требования в выбранных днях будут заменены скопированными."))
                        .font(.footnote)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }
            }
            .navigationTitle(languageManager.text("Copy To", "Копировать в"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(languageManager.text("Cancel", "Отмена")) {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button(languageManager.text("Copy", "Копировать")) {
                        onCopy(selectedTargets)
                        dismiss()
                    }
                    .disabled(selectedTargets.isEmpty)
                }
            }
        }
    }
}
