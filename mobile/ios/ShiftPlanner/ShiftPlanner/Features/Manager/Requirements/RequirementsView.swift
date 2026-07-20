import SwiftUI
import UniformTypeIdentifiers

struct RequirementsView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel: RequirementsViewModel

    @State private var isShowingCopySheet = false
    @State private var showImporter = false

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
                        showImporter = true
                    } label: {
                        Image(systemName: "square.and.arrow.down")
                    }
                    .disabled(!viewModel.canManageRequirements || viewModel.isImporting)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.startCreating()
                    } label: {
                        Image(systemName: "plus")
                    }
                    .disabled(!viewModel.canManageRequirements)
                }
            }
            .fileImporter(
                isPresented: $showImporter,
                allowedContentTypes: [.spreadsheet],
                allowsMultipleSelection: false
            ) { result in
                switch result {
                case .success(let urls):
                    guard let url = urls.first else { return }
                    Task { @MainActor in
                        let didAccess = url.startAccessingSecurityScopedResource()
                        defer { if didAccess { url.stopAccessingSecurityScopedResource() } }
                        do {
                            let data = try Data(contentsOf: url)
                            await viewModel.importRequirements(fileData: data, fileName: url.lastPathComponent)
                        } catch {
                            viewModel.errorMessage = error.localizedDescription
                        }
                    }
                case .failure(let error):
                    let message = error.localizedDescription
                    Task { @MainActor in viewModel.errorMessage = message }
                }
            }
            .alert(
                languageManager.text("Import finished", "Импорт завершён"),
                isPresented: Binding(
                    get: { viewModel.importResult != nil },
                    set: { if !$0 { viewModel.importResult = nil } }
                ),
                presenting: viewModel.importResult
            ) { _ in
                Button("OK", role: .cancel) { viewModel.importResult = nil }
            } message: { result in
                if result.errors.isEmpty {
                    Text(languageManager.text(
                        "Imported \(result.createdCount) requirements.",
                        "Импортировано требований: \(result.createdCount)."
                    ))
                } else {
                    Text(
                        languageManager.text(
                            "Imported \(result.createdCount). \(result.errors.count) rows had errors:",
                            "Импортировано: \(result.createdCount). Строк с ошибками: \(result.errors.count):"
                        )
                        + "\n"
                        + result.errors.prefix(5).map { "• \($0.row): \($0.message)" }.joined(separator: "\n")
                    )
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
            .buttonStyle(.plain)
            .themeCompactSecondaryAction()
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
