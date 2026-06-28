import SwiftUI

struct ManagerScheduleView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel: ManagerScheduleViewModel

    let user: AppUser
    let onUserUpdated: (AppUser) -> Void
    @State private var selectedTab: ScheduleContentTab = .assigned
    @State private var selectedPresentationMode: SchedulePresentationMode = .list
    @State private var editingShiftDraft: ScheduleShiftEditorDraft?
    @State private var assigningRequirement: AppUnfilledRequirement?
    @State private var editingRequirementDraft: ScheduleRequirementEditorDraft?
    @State private var requirementPendingDeletion: AppUnfilledRequirement?

    init(user: AppUser, onUserUpdated: @escaping (AppUser) -> Void) {
        self.user = user
        self.onUserUpdated = onUserUpdated
        _viewModel = StateObject(wrappedValue: ManagerScheduleViewModel(user: user))
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                if user.hasCompany {
                    VStack(alignment: .leading, spacing: 16) {
                        generationControlsCard

                        if let statusMessage = viewModel.statusMessage {
                            statusCard(
                                message: statusMessage,
                                color: themeManager.selectedTheme.secondaryTextColor
                            )
                        }

                        if let errorMessage = viewModel.errorMessage {
                            statusCard(
                                message: errorMessage,
                                color: themeManager.selectedTheme.destructiveColor
                            )
                        }

                        if viewModel.isLoading {
                            ProgressView(languageManager.text("Loading latest schedule...", "Загрузка последнего расписания..."))
                                .tint(themeManager.selectedTheme.accentColor)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding()
                                .themeCard()
                        }

                        if let schedule = viewModel.schedule {
                            scheduleSummaryCard(schedule)

                            contentTabPicker
                            presentationModePicker

                            switch selectedTab {
                            case .assigned:
                                if schedule.sortedShifts.isEmpty {
                                    tabEmptyStateCard(
                                        title: languageManager.text("No assigned shifts", "Заполненных смен пока нет"),
                                        message: languageManager.text("Generate a draft or adjust the selected period to see assigned shifts here.", "Сгенерируйте черновик или измените период, чтобы увидеть здесь заполненные смены.")
                                    )
                                } else if selectedPresentationMode == .list {
                                    shiftsCard(schedule.sortedShifts)
                                } else {
                                    assignedCalendarCard(schedule.sortedShifts)
                                }
                            case .unfilled:
                                if schedule.sortedUnfilledRequirements.isEmpty {
                                    tabEmptyStateCard(
                                        title: languageManager.text("No unfilled shifts", "Незаполненных смен нет"),
                                        message: languageManager.text("Great news: all current requirements are covered in this draft.", "Хорошая новость: все текущие требования покрыты в этом черновике.")
                                    )
                                } else if selectedPresentationMode == .list {
                                    unfilledRequirementsCard(schedule.sortedUnfilledRequirements)
                                } else {
                                    unfilledCalendarCard(schedule.sortedUnfilledRequirements)
                                }
                            }
                        } else if !viewModel.isLoading {
                            emptyStateCard
                        }
                    }
                    .padding()
                } else {
                    ManagerCompanyAccessContentView(
                        user: user,
                        onUserUpdated: onUserUpdated
                    )
                    .padding(.top, 8)
                }
            }
            .background(themeManager.selectedTheme.screenBackground.ignoresSafeArea())
            .navigationTitle(languageManager.text("Schedule", "График"))
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                Task {
                    await viewModel.loadLatestSchedule()
                }
            }
            .sheet(item: $editingShiftDraft) { draft in
                ScheduleShiftEditorSheet(
                    draft: draft,
                    positions: viewModel.availablePositions,
                    employees: viewModel.employees,
                    recommendedEmployees: viewModel.recommendedEmployees,
                    isSubmitting: viewModel.isSavingShift,
                    isLoadingRecommendedEmployees: viewModel.isLoadingRecommendedEmployees,
                    onLoadRecommended: { updatedDraft in
                        await viewModel.loadRecommendedEmployees(for: updatedDraft)
                    },
                    onSave: { updatedDraft in
                        await viewModel.saveShift(updatedDraft)
                    },
                    onDelete: { updatedDraft in
                        await viewModel.deleteShift(updatedDraft)
                    }
                )
                .onDisappear {
                    viewModel.clearRecommendedEmployees()
                }
            }
            .sheet(item: $assigningRequirement) { requirement in
                ShiftEditorSheet(
                    shift: AppScheduledShift(
                        id: requirement.id,
                        employeeId: nil,
                        employeeName: nil,
                        positionId: requirement.positionId,
                        positionName: requirement.positionTitle,
                        date: requirement.date,
                        startMinutes: requirement.startMinutes,
                        endMinutes: requirement.endMinutes
                    ),
                    recommendedEmployees: viewModel.recommendedEmployeesForRequirement,
                    employees: viewModel.eligibleEmployees(
                        for: requirement.positionId,
                        branchId: viewModel.requirementBranchId(for: requirement)
                    ),
                    isSubmitting: viewModel.isAssigningRequirement,
                    isLoadingRecommendedEmployees: viewModel.isLoadingRecommendedEmployees,
                    canRemoveShift: false,
                    onLoadRecommended: {
                        await viewModel.loadRecommendedEmployees(for: requirement)
                    },
                    onAssign: { employeeId in
                        Task {
                            await viewModel.assignRequirement(requirement, employeeId: employeeId)
                            if viewModel.errorMessage == nil {
                                assigningRequirement = nil
                            }
                        }
                    },
                    onRemove: {}
                )
                .onDisappear {
                    viewModel.clearRecommendedEmployees()
                }
            }
            .sheet(item: $editingRequirementDraft) { draft in
                ScheduleRequirementEditorSheet(
                    draft: draft,
                    availablePositions: viewModel.availablePositions,
                    isSubmitting: viewModel.isSavingRequirement,
                    onSave: { updatedDraft in
                        await viewModel.saveRequirement(updatedDraft)
                    }
                )
            }
            .confirmationDialog(
                languageManager.text("Delete this shift?", "Удалить эту смену?"),
                isPresented: requirementDeleteBinding,
                titleVisibility: .visible
            ) {
                Button(languageManager.text("Delete", "Удалить"), role: .destructive) {
                    guard let requirement = requirementPendingDeletion else { return }
                    Task {
                        let didDelete = await viewModel.deleteRequirement(requirement)
                        if didDelete {
                            requirementPendingDeletion = nil
                        }
                    }
                }
                Button(languageManager.text("Cancel", "Отмена"), role: .cancel) {
                    requirementPendingDeletion = nil
                }
            } message: {
                Text(
                    languageManager.text(
                        "The unfilled shift will be removed from the schedule.",
                        "Незаполненная смена будет удалена из расписания."
                    )
                )
            }
        }
    }

    private var generationControlsCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(languageManager.text("Generate schedule", "Сгенерировать расписание"))
                .font(.title3)
                .fontWeight(.bold)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            Text(languageManager.text("The backend now builds the draft using staffing requirements and employee availability for the selected period.", "Бэкенд теперь собирает черновик по требованиям и доступности сотрудников за выбранный период."))
                .font(.subheadline)
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(languageManager.text("From", "С"))
                        .font(.footnote)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                    DatePicker(
                        "",
                        selection: $viewModel.startDate,
                        displayedComponents: .date
                    )
                    .labelsHidden()
                    .datePickerStyle(.compact)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .background(themeManager.selectedTheme.fieldColor)
                .overlay {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
                }
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                VStack(alignment: .leading, spacing: 6) {
                    Text(languageManager.text("To", "До"))
                        .font(.footnote)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                    DatePicker(
                        "",
                        selection: $viewModel.endDate,
                        in: viewModel.startDate...,
                        displayedComponents: .date
                    )
                    .labelsHidden()
                    .datePickerStyle(.compact)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .background(themeManager.selectedTheme.fieldColor)
                .overlay {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
                }
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }

            Button {
                Task {
                    await viewModel.generateSchedule()
                }
            } label: {
                if viewModel.isGenerating {
                    ProgressView()
                        .tint(themeManager.selectedTheme.primaryActionTextColor)
                        .frame(maxWidth: .infinity)
                } else {
                    Text(languageManager.text("Generate draft", "Сгенерировать черновик"))
                }
            }
            .buttonStyle(.plain)
            .themePrimaryAction(isEnabled: viewModel.canGenerate)
            .disabled(!viewModel.canGenerate)
        }
        .padding(18)
        .themeCard()
    }

    private func scheduleSummaryCard(_ schedule: AppSchedule) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(viewModel.scheduleTitle)
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                    Text(schedule.status.title)
                        .font(.footnote)
                        .fontWeight(.semibold)
                        .foregroundStyle(themeManager.selectedTheme.accentColor)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(themeManager.selectedTheme.cardTint)
                        .clipShape(Capsule())
                }

                Spacer(minLength: 8)

                VStack(spacing: 8) {
                    Button {
                        editingShiftDraft = viewModel.makeShiftDraft(for: viewModel.startDate)
                    } label: {
                        Text(languageManager.text("Add shift", "Добавить смену"))
                    }
                    .buttonStyle(.plain)
                    .themeSecondaryAction()

                    if schedule.status == .draft {
                        Button {
                            Task {
                                await viewModel.publishSchedule()
                            }
                        } label: {
                            if viewModel.isPublishing {
                                ProgressView()
                                    .tint(themeManager.selectedTheme.primaryActionTextColor)
                                    .frame(maxWidth: .infinity)
                            } else {
                                Text(languageManager.text("Publish", "Опубликовать"))
                            }
                        }
                        .buttonStyle(.plain)
                        .themePrimaryAction(isEnabled: viewModel.canPublish)
                        .disabled(!viewModel.canPublish)
                    }
                }
                .frame(maxWidth: 160)
            }

            HStack(spacing: 12) {
                scheduleMetric(
                    title: languageManager.text("Shifts", "Смены"),
                    value: "\(schedule.shifts.count)"
                )
                scheduleMetric(
                    title: languageManager.text("Unfilled", "Незаполнено"),
                    value: "\(schedule.unfilledRequirements.count)"
                )
            }
        }
        .padding(18)
        .themeCard()
    }

    private var contentTabPicker: some View {
        Picker("", selection: $selectedTab) {
            Text(languageManager.text("Assigned", "Заполненные"))
                .tag(ScheduleContentTab.assigned)
            Text(languageManager.text("Unfilled", "Незаполненные"))
                .tag(ScheduleContentTab.unfilled)
        }
        .pickerStyle(.segmented)
        .padding(8)
        .background(themeManager.selectedTheme.elevatedSurfaceColor)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
        }
    }

    private var presentationModePicker: some View {
        Picker("", selection: $selectedPresentationMode) {
            Text(languageManager.text("List", "Список"))
                .tag(SchedulePresentationMode.list)
            Text(languageManager.text("Calendar", "Календарь"))
                .tag(SchedulePresentationMode.calendar)
        }
        .pickerStyle(.segmented)
        .padding(8)
        .background(themeManager.selectedTheme.elevatedSurfaceColor)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
        }
    }

    private func scheduleMetric(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.footnote)
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(themeManager.selectedTheme.cardTint)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func unfilledRequirementsCard(_ items: [AppUnfilledRequirement]) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(languageManager.text("Unfilled requirements", "Незаполненные требования"))
                .font(.headline)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            ForEach(groupedRequirementSections(from: items), id: \.date) { section in
                VStack(alignment: .leading, spacing: 10) {
                    dayHeader(date: section.date)

                    ForEach(section.items) { item in
                        unfilledRequirementRow(item)
                    }
                }
            }
        }
        .padding(18)
        .themeCard()
    }

    private func shiftsCard(_ shifts: [AppScheduledShift]) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(languageManager.text("Assigned shifts", "Назначенные смены"))
                .font(.headline)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            ForEach(groupedShiftSections(from: shifts), id: \.date) { section in
                VStack(alignment: .leading, spacing: 10) {
                    dayHeader(date: section.date)

                    ForEach(section.shifts) { shift in
                        shiftRow(shift)
                    }
                }
            }
        }
        .padding(18)
        .themeCard()
    }

    private func assignedCalendarCard(_ shifts: [AppScheduledShift]) -> some View {
        ScheduleCalendarSectionView(
            items: shifts,
            sectionTitle: languageManager.text("Assigned shifts on selected day", "Заполненные смены на выбранный день"),
            dateProvider: \.date
        ) { shift in
            shiftRow(shift)
        }
    }

    private func unfilledCalendarCard(_ items: [AppUnfilledRequirement]) -> some View {
        ScheduleCalendarSectionView(
            items: items,
            sectionTitle: languageManager.text("Unfilled requirements on selected day", "Незаполненные требования на выбранный день"),
            dateProvider: \.date
        ) { item in
            unfilledRequirementRow(item)
        }
    }

    private var emptyStateCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(languageManager.text("No schedule yet", "Расписания пока нет"))
                .font(.headline)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            Text(languageManager.text("Create requirements and availability first, then generate a draft for the selected period here.", "Сначала заполните требования и доступность, а затем сгенерируйте здесь черновик на выбранный период."))
                .font(.subheadline)
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .themeCard()
    }

    private func tabEmptyStateCard(title: String, message: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            Text(message)
                .font(.subheadline)
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .themeCard()
    }

    private func statusCard(message: String, color: Color) -> some View {
        Text(message)
            .font(.footnote)
            .foregroundStyle(color)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .themeCard()
    }

    private func unfilledRequirementRow(_ item: AppUnfilledRequirement) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.positionTitle)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                }

                Spacer()

                HStack(spacing: 8) {
                    Text(
                        languageManager.format(
                            "Missing: %d",
                            "Не хватает: %d",
                            item.missingStaff
                        )
                    )
                    .font(.footnote)
                    .fontWeight(.semibold)
                    .foregroundStyle(themeManager.selectedTheme.destructiveColor)

                    actionPill(
                        title: languageManager.text("Assign", "Назначить"),
                        systemImage: "person.badge.plus"
                    ) {
                        assigningRequirement = item
                    }

                    actionPill(
                        title: languageManager.text("Edit", "Изменить"),
                        systemImage: "square.and.pencil"
                    ) {
                        editingRequirementDraft = viewModel.makeRequirementDraft(for: item)
                    }

                    actionPill(
                        title: languageManager.text("Delete", "Удалить"),
                        systemImage: "trash",
                        foregroundColor: themeManager.selectedTheme.destructiveColor
                    ) {
                        requirementPendingDeletion = item
                    }
                }
            }

            Text(formattedTimeRange(startMinutes: item.startMinutes, endMinutes: item.endMinutes))
                .font(.footnote)
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(themeManager.selectedTheme.cardTint)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func shiftRow(_ shift: AppScheduledShift) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(shift.positionName)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                    Text(
                        shift.employeeName ??
                        languageManager.text("Unassigned shift", "Смена пока не назначена")
                    )
                        .font(.footnote)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 8) {
                    Text(formattedTimeRange(startMinutes: shift.startMinutes, endMinutes: shift.endMinutes))
                        .font(.footnote)
                        .fontWeight(.semibold)
                        .foregroundStyle(themeManager.selectedTheme.accentColor)

                    Button {
                        editingShiftDraft = viewModel.makeShiftDraft(for: shift)
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "square.and.pencil")
                                .font(.caption)
                            Text(languageManager.text("Edit", "Изменить"))
                                .font(.caption)
                                .fontWeight(.semibold)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(themeManager.selectedTheme.elevatedSurfaceColor)
                        .overlay {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(themeManager.selectedTheme.cardTint)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func groupedShiftSections(from shifts: [AppScheduledShift]) -> [ShiftSection] {
        let grouped = Dictionary(grouping: shifts, by: \.date)
        return grouped.keys.sorted().map { date in
            ShiftSection(
                date: date,
                shifts: grouped[date]?.sorted { $0.startMinutes < $1.startMinutes } ?? []
            )
        }
    }

    private func groupedRequirementSections(from items: [AppUnfilledRequirement]) -> [RequirementSection] {
        let grouped = Dictionary(grouping: items, by: \.date)
        return grouped.keys.sorted().map { date in
            RequirementSection(
                date: date,
                items: grouped[date]?.sorted { lhs, rhs in
                    if lhs.startMinutes == rhs.startMinutes {
                        return lhs.positionTitle < rhs.positionTitle
                    }
                    return lhs.startMinutes < rhs.startMinutes
                } ?? []
            )
        }
    }

    private func dayHeader(date: Date) -> some View {
        HStack(alignment: .center, spacing: 12) {
            Text(formattedDate(date))
                .font(.subheadline)
                .fontWeight(.bold)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            Spacer()

            Button {
                editingShiftDraft = viewModel.makeShiftDraft(for: date)
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "plus")
                        .font(.caption)
                    Text(languageManager.text("Add shift", "Добавить смену"))
                        .font(.caption)
                        .fontWeight(.semibold)
                        .lineLimit(1)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(themeManager.selectedTheme.elevatedSurfaceColor)
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
                }
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
        }
    }

    private func actionPill(
        title: String,
        systemImage: String,
        foregroundColor: Color? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: systemImage)
                    .font(.caption)
                Text(title)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .lineLimit(1)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(themeManager.selectedTheme.elevatedSurfaceColor)
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .foregroundStyle(foregroundColor ?? themeManager.selectedTheme.primaryTextColor)
    }

    private var requirementDeleteBinding: Binding<Bool> {
        Binding(
            get: { requirementPendingDeletion != nil },
            set: { isPresented in
                if !isPresented {
                    requirementPendingDeletion = nil
                }
            }
        )
    }

    private func formattedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = languageManager.locale
        formatter.dateFormat = "EEEE, d MMM"
        return formatter.string(from: date)
    }

    private func formattedTimeRange(startMinutes: Int, endMinutes: Int) -> String {
        "\(formattedTime(startMinutes)) - \(formattedTime(endMinutes))"
    }

    private func formattedTime(_ minutes: Int) -> String {
        let hour = minutes / 60
        let minute = minutes % 60
        return String(format: "%02d:%02d", hour, minute)
    }
}

private enum ScheduleContentTab: Hashable {
    case assigned
    case unfilled
}

private struct ShiftSection {
    let date: Date
    let shifts: [AppScheduledShift]
}

private struct RequirementSection {
    let date: Date
    let items: [AppUnfilledRequirement]
}
