import SwiftUI

struct EmployeeScheduleView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel: EmployeeScheduleViewModel
    @State private var selectedPresentationMode: SchedulePresentationMode = .list

    let user: AppUser
    let onJoinRequested: () -> Void

    init(user: AppUser, onJoinRequested: @escaping () -> Void) {
        self.user = user
        self.onJoinRequested = onJoinRequested
        _viewModel = StateObject(wrappedValue: EmployeeScheduleViewModel(user: user))
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                if user.hasCompany, user.employeeId != nil {
                    VStack(alignment: .leading, spacing: 16) {
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
                            ProgressView(languageManager.text("Loading shifts...", "Загрузка смен..."))
                                .tint(themeManager.selectedTheme.accentColor)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding()
                                .themeCard()
                        } else if viewModel.hasShifts {
                            presentationModePicker

                            if selectedPresentationMode == .list {
                                shiftsCard
                            } else {
                                calendarCard
                            }
                        } else {
                            emptyStateCard
                        }
                    }
                    .padding()
                } else {
                    CompanyMembershipBannerView(
                        title: languageManager.text("Join a company first to see your published shifts.", "Сначала присоединитесь к компании, чтобы видеть опубликованные смены."),
                        buttonTitle: languageManager.text("Enter invite code", "Ввести код"),
                        action: onJoinRequested
                    )
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

    private var shiftsCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(languageManager.text("Your upcoming shifts", "Ваши предстоящие смены"))
                .font(.title3)
                .fontWeight(.bold)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            ForEach(groupedSections, id: \.date) { section in
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

    private var calendarCard: some View {
        ScheduleCalendarSectionView(
            items: viewModel.shifts,
            sectionTitle: languageManager.text("Shifts on selected day", "Смены на выбранный день"),
            dateProvider: \.date
        ) { shift in
            shiftRow(shift)
        }
    }

    private var emptyStateCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(languageManager.text("No published shifts yet", "Опубликованных смен пока нет"))
                .font(.headline)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            Text(languageManager.text("As soon as the manager publishes a schedule, your shifts will appear here.", "Как только менеджер опубликует расписание, ваши смены появятся здесь."))
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

    private func shiftRow(_ shift: AppScheduledShift) -> some View {
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
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(themeManager.selectedTheme.cardTint)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var groupedSections: [EmployeeShiftSection] {
        let grouped = Dictionary(grouping: viewModel.shifts, by: \.date)
        return grouped.keys.sorted().map { date in
            EmployeeShiftSection(
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

private struct EmployeeShiftSection {
    let date: Date
    let shifts: [AppScheduledShift]
}
