import SwiftUI

struct ManagerScheduleView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel: ManagerScheduleViewModel

    let user: AppUser
    let onUserUpdated: (AppUser) -> Void
    @State private var selectedTab: ScheduleContentTab = .assigned
    @State private var selectedPresentationMode: SchedulePresentationMode = .list

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
            .task {
                await viewModel.loadScheduleIfNeeded()
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
                    .frame(maxWidth: 150)
                    .disabled(!viewModel.canPublish)
                }
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

            ForEach(items) { item in
                unfilledRequirementRow(item)
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
                    Text(formattedDate(section.date))
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

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

                    Text(formattedDate(item.date))
                        .font(.footnote)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }

                Spacer()

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
                    Text(shift.employeeName)
                        .font(.footnote)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }

                Spacer()

                Text(formattedTimeRange(startMinutes: shift.startMinutes, endMinutes: shift.endMinutes))
                    .font(.footnote)
                    .fontWeight(.semibold)
                    .foregroundStyle(themeManager.selectedTheme.accentColor)
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
