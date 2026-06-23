import SwiftUI

struct RequirementsView: View {
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel: RequirementsViewModel
    @State private var isShowingClearConfirmation = false
    @State private var isShowingClearAllConfirmation = false
    @State private var isShowingCopySheet = false
    private let user: AppUser
    private let onUserUpdated: (AppUser) -> Void

    @MainActor
    init(
        user: AppUser,
        onUserUpdated: @escaping (AppUser) -> Void,
        repository: RequirementsRepository? = nil
    ) {
        self.user = user
        self.onUserUpdated = onUserUpdated
        _viewModel = StateObject(
            wrappedValue: RequirementsViewModel(
                user: user,
                repository: repository
            )
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                if user.hasCompany {
                    VStack(alignment: .leading, spacing: 18) {
                        Text(languageManager.text("Templates for", "Шаблоны на") + " \(viewModel.monthTitle)")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                        RequirementsDayPickerView(
                            selectedWeekday: viewModel.selectedWeekday,
                            onSelectWeekday: viewModel.selectWeekday(_:),
                            labels: viewModel.weekdayLabels
                        )

                        HStack(spacing: 12) {
                            Button(languageManager.text("Copy to", "Копировать в")) {
                                isShowingCopySheet = true
                            }
                            .buttonStyle(.plain)
                            .themeCompactSecondaryAction()
                            .disabled(viewModel.requirementsForSelectedDay.isEmpty || !viewModel.canManageRequirements)

                            Button(languageManager.text("Clear day", "Очистить день")) {
                                isShowingClearConfirmation = true
                            }
                            .buttonStyle(.plain)
                            .themeCompactSecondaryAction()
                            .disabled(viewModel.requirementsForSelectedDay.isEmpty || !viewModel.canManageRequirements)

                            Button(languageManager.text("Clear all days", "Очистить всё")) {
                                isShowingClearAllConfirmation = true
                            }
                            .buttonStyle(.plain)
                            .themeCompactSecondaryAction()
                            .disabled(viewModel.requirements.isEmpty || !viewModel.canManageRequirements)
                        }

                        Button {
                            viewModel.startCreating()
                        } label: {
                            HStack(spacing: 10) {
                                if viewModel.isSaving {
                                    ProgressView()
                                        .tint(themeManager.selectedTheme.primaryActionTextColor)
                                }

                                Label(languageManager.text("Add requirement", "Добавить требование"), systemImage: "plus")
                            }
                        }
                        .buttonStyle(.plain)
                        .themePrimaryAction(isEnabled: viewModel.canManageRequirements)
                        .disabled(!viewModel.canManageRequirements)

                        RequirementsWorkingHoursRowView(
                            weekdayLabel: viewModel.selectedWeekdaySummary,
                            workingHours: viewModel.selectedDayWorkingHours,
                            onUpdate: viewModel.updateWorkingHours(startSlot:endSlot:)
                        )
                        .disabled(!viewModel.canManageRequirements)

                        if let statusMessage = viewModel.statusMessage {
                            Text(statusMessage)
                                .font(.footnote)
                                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        }

                        if let errorMessage = viewModel.errorMessage {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundStyle(themeManager.selectedTheme.destructiveColor)
                        }

                        if viewModel.isLoading {
                            HStack {
                                    Spacer()
                                    ProgressView(languageManager.text("Loading requirements...", "Загрузка требований..."))
                                    Spacer()
                                }
                                .padding(.vertical, 28)
                        } else if viewModel.requirementsForSelectedDay.isEmpty {
                            VStack(spacing: 12) {
                                Image(systemName: "calendar.badge.plus")
                                    .font(.system(size: 42))
                                    .foregroundStyle(themeManager.selectedTheme.accentColor)

                                Text(languageManager.text("No requirements yet", "Требований пока нет"))
                                    .font(.title3)
                                    .fontWeight(.bold)
                                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                                Text(languageManager.text("Add staffing intervals for the selected day, or create one rule and apply it to several days at once in the form.", "Добавьте интервалы для выбранного дня или создайте одно правило и примените его сразу к нескольким дням в форме."))
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
                } else {
                    ManagerCompanyAccessContentView(
                        user: user,
                        onUserUpdated: onUserUpdated
                    )
                    .padding()
                }
            }
            .background(themeManager.selectedTheme.screenBackground)
            .navigationTitle(languageManager.text("Requirements", "Требования"))
            .navigationBarTitleDisplayMode(.inline)
            .sheet(item: $viewModel.activeDraft) { draft in
                RequirementFormView(
                    draft: draft,
                    availablePositions: viewModel.availablePositions,
                    workingHoursByWeekday: viewModel.workingHoursByWeekday,
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
            .alert(languageManager.text("Clear selected day?", "Очистить выбранный день?"), isPresented: $isShowingClearConfirmation) {
                Button(languageManager.text("Cancel", "Отмена"), role: .cancel) {}
                Button(languageManager.text("Clear", "Очистить"), role: .destructive) {
                    viewModel.clearSelectedDay()
                }
            } message: {
                Text(languageManager.text("This will remove all requirements for", "Это удалит все требования для") + " \(viewModel.selectedWeekdaySummary).")
            }
            .alert(languageManager.text("Clear all days?", "Очистить все дни?"), isPresented: $isShowingClearAllConfirmation) {
                Button(languageManager.text("Cancel", "Отмена"), role: .cancel) {}
                Button(languageManager.text("Clear all", "Очистить всё"), role: .destructive) {
                    viewModel.clearAllDays()
                }
            } message: {
                Text(languageManager.text("This will remove all requirement templates for the whole week.", "Это удалит все шаблоны требований на всю неделю."))
            }
            .task {
                if user.hasCompany {
                    await viewModel.loadInitialData()
                }
            }
            .onDisappear {
                if user.hasCompany {
                    Task {
                        await viewModel.autoSaveIfNeeded()
                    }
                }
            }
            .onChange(of: scenePhase) { _, newPhase in
                guard user.hasCompany, newPhase == .background else { return }
                Task {
                    await viewModel.autoSaveIfNeeded()
                }
            }
        }
    }
}
