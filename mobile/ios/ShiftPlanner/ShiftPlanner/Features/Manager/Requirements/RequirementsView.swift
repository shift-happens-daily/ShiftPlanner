import SwiftUI

struct RequirementsView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @StateObject private var viewModel = RequirementsViewModel()
    @State private var isShowingClearConfirmation = false
    @State private var isShowingCopySheet = false

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 18) {
                    RequirementsDayPickerView(
                        selectedWeekday: viewModel.selectedWeekday,
                        onSelectWeekday: viewModel.selectWeekday(_:),
                        labels: viewModel.weekdayLabels
                    )

                    HStack(spacing: 12) {
                        Button("Copy to") {
                            isShowingCopySheet = true
                        }
                        .buttonStyle(.plain)
                        .themeSecondaryAction()
                        .disabled(viewModel.requirementsForSelectedDay.isEmpty)

                        Button("Clear day") {
                            isShowingClearConfirmation = true
                        }
                        .buttonStyle(.plain)
                        .themeSecondaryAction()
                    }

                    Button {
                        viewModel.startCreating()
                    } label: {
                        Label("Add requirement", systemImage: "plus")
                    }
                    .buttonStyle(.plain)
                    .themePrimaryAction()

                    if viewModel.requirementsForSelectedDay.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "calendar.badge.plus")
                                .font(.system(size: 42))
                                .foregroundStyle(themeManager.selectedTheme.accentColor)

                            Text("No requirements yet")
                                .font(.title3)
                                .fontWeight(.bold)
                                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                            Text("Add staffing intervals for the selected day, or create one rule and apply it to several days at once in the form.")
                                .multilineTextAlignment(.center)
                                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(28)
                        .themeCard()
                    } else {
                        VStack(spacing: 12) {
                            ForEach(viewModel.requirementsForSelectedDay) { requirement in
                                RequirementCardView(
                                    requirement: requirement,
                                    onEdit: { viewModel.startEditing(requirement) },
                                    onDuplicate: { viewModel.duplicate(requirement) },
                                    onDelete: { viewModel.delete(requirement) }
                                )
                            }
                        }
                    }
                }
                .padding()
            }
            .background(themeManager.selectedTheme.screenBackground)
            .navigationTitle("Requirements")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(item: $viewModel.activeDraft) { draft in
                RequirementFormView(
                    draft: draft,
                    availablePositions: viewModel.availablePositions,
                    onCancel: viewModel.cancelEditing,
                    onSave: viewModel.saveDraft
                )
            }
            .sheet(isPresented: $isShowingCopySheet) {
                RequirementsCopyTargetsView(
                    sourceWeekday: viewModel.selectedWeekday,
                    labels: viewModel.weekdayLabels,
                    onCopy: viewModel.copySelectedDay(to:)
                )
            }
            .alert("Clear selected day?", isPresented: $isShowingClearConfirmation) {
                Button("Cancel", role: .cancel) {}
                Button("Clear", role: .destructive) {
                    viewModel.clearSelectedDay()
                }
            } message: {
                Text("This will remove all requirements for \(viewModel.selectedWeekdaySummary).")
            }
        }
    }
}
