import SwiftUI

struct RequirementsView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel: RequirementsViewModel

    @State private var isShowingCopySheet = false

    init(user: AppUser) {
        _viewModel = StateObject(wrappedValue: RequirementsViewModel(user: user))
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 16) {
                    Text(viewModel.monthTitle)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    RequirementsDayPickerView(
                        selectedWeekday: viewModel.selectedWeekday,
                        onSelectWeekday: { viewModel.selectWeekday($0) },
                        labels: viewModel.weekdayLabels
                    )

                    RequirementsWorkingHoursRowView(
                        weekdayLabel: viewModel.selectedWeekdaySummary,
                        workingHours: viewModel.selectedDayWorkingHours,
                        onUpdate: { start, end in viewModel.updateWorkingHours(startSlot: start, endSlot: end) }
                    )

                    dayActionsRow

                    if viewModel.isLoading {
                        ProgressView().padding(.top, 24)
                    } else if viewModel.requirementsForSelectedDay.isEmpty {
                        Text(languageManager.text(
                            "No requirements for this day yet.",
                            "На этот день ещё нет требований."
                        ))
                        .font(.footnote)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 12)
                    } else {
                        ForEach(viewModel.requirementsForSelectedDay) { requirement in
                            RequirementCardView(
                                requirement: requirement,
                                onEdit: { viewModel.startEditing(requirement) },
                                onDuplicate: { viewModel.duplicate(requirement) },
                                onDelete: { viewModel.delete(requirement) }
                            )
                        }
                    }

                    if viewModel.hasUnsavedChanges {
                        saveButton
                    }

                    messages
                }
                .padding()
            }
            .background(themeManager.selectedTheme.screenBackground)
            .navigationTitle(languageManager.text("Requirements", "Требования"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.startCreating()
                    } label: {
                        Image(systemName: "plus")
                    }
                    .disabled(!viewModel.canManageRequirements)
                }
            }
            .task { await viewModel.loadInitialData() }
            .sheet(item: $viewModel.activeDraft) { draft in
                RequirementFormView(
                    draft: draft,
                    availablePositions: viewModel.availablePositions,
                    workingHoursByWeekday: viewModel.workingHoursByWeekday,
                    onCancel: { viewModel.cancelEditing() },
                    onSave: { viewModel.saveDraft($0) }
                )
                .environmentObject(themeManager)
                .environmentObject(languageManager)
            }
        }
    }

    private var dayActionsRow: some View {
        HStack(spacing: 10) {
            Button {
                isShowingCopySheet = true
            } label: {
                Label(languageManager.text("Copy to…", "Копировать в…"), systemImage: "doc.on.doc")
                    .font(.footnote.weight(.semibold))
            }
            .buttonStyle(.bordered)
            .disabled(viewModel.requirementsForSelectedDay.isEmpty)
            .sheet(isPresented: $isShowingCopySheet) {
                RequirementsCopyTargetsView(
                    sourceWeekday: viewModel.selectedWeekday,
                    labels: viewModel.weekdayLabels,
                    onCopy: { viewModel.copySelectedDay(to: $0) }
                )
                .environmentObject(themeManager)
                .environmentObject(languageManager)
            }

            Menu {
                Button(languageManager.text("Clear this day", "Очистить этот день"), role: .destructive) {
                    viewModel.clearSelectedDay()
                }
                Button(languageManager.text("Clear all days", "Очистить все дни"), role: .destructive) {
                    viewModel.clearAllDays()
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.title3)
            }

            Spacer()
        }
    }

    private var saveButton: some View {
        Button {
            Task { await viewModel.saveChanges() }
        } label: {
            HStack(spacing: 10) {
                if viewModel.isSaving {
                    ProgressView().tint(themeManager.selectedTheme.primaryActionTextColor)
                }
                Text(viewModel.isSaving
                    ? languageManager.text("Saving…", "Сохранение…")
                    : languageManager.text("Save changes", "Сохранить изменения"))
                    .font(.headline.weight(.semibold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .foregroundStyle(themeManager.selectedTheme.primaryActionTextColor)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(viewModel.isSaving
                        ? themeManager.selectedTheme.secondaryTextColor.opacity(0.45)
                        : themeManager.selectedTheme.primaryActionFillColor)
            )
        }
        .buttonStyle(.plain)
        .disabled(viewModel.isSaving)
    }

    @ViewBuilder
    private var messages: some View {
        if let statusMessage = viewModel.statusMessage {
            Text(statusMessage)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        if let errorMessage = viewModel.errorMessage {
            Text(errorMessage)
                .font(.footnote)
                .foregroundStyle(.red)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
