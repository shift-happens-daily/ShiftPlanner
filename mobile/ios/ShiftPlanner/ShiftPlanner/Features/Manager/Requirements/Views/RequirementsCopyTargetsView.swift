import SwiftUI

struct RequirementsCopyTargetsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var themeManager: ThemeManager
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
                Section("Copy from") {
                    Text(labels[sourceWeekday])
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }

                Section("Copy to") {
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
                    Text("Existing requirements on selected target days will be replaced with the copied ones.")
                        .font(.footnote)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }
            }
            .navigationTitle("Copy To")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Copy") {
                        onCopy(selectedTargets)
                        dismiss()
                    }
                    .disabled(selectedTargets.isEmpty)
                }
            }
        }
    }
}
