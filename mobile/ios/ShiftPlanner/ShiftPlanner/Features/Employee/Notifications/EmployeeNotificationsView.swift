import SwiftUI

/// Employee-side notifications panel: published schedule, assigned shifts,
/// time-off request status, and company-membership confirmation. Opened from
/// the bell in the schedule tab's toolbar.
struct EmployeeNotificationsView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: EmployeeNotificationsViewModel

    init(companyName: String?) {
        _viewModel = StateObject(wrappedValue: EmployeeNotificationsViewModel(companyName: companyName))
    }

    var body: some View {
        NavigationStack {
            List {
                scheduleSection
                shiftsSection
                timeOffSection
                companySection

                if let errorMessage = viewModel.errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(themeManager.selectedTheme.destructiveColor)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(themeManager.selectedTheme.screenBackground)
            .navigationTitle(localized("Notifications", "Уведомления"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(localized("Close", "Закрыть")) { dismiss() }
                }
            }
            .overlay {
                if viewModel.isLoading && viewModel.upcomingShifts.isEmpty {
                    ProgressView()
                }
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
        }
    }

    // MARK: - Sections

    private var scheduleSection: some View {
        Section(localized("Schedule", "Расписание")) {
            if let schedule = viewModel.publishedSchedule {
                if let period = formatPeriod(schedule.startDate, schedule.endDate) {
                    infoRow(
                        title: localized("Schedule published for \(period)", "Опубликовано расписание на \(period)"),
                        subtitle: nil
                    )
                } else {
                    infoRow(
                        title: localized("A new schedule was published", "Опубликовано новое расписание"),
                        subtitle: nil
                    )
                }
            } else {
                emptyRow(localized("No published schedule yet.", "Опубликованного расписания пока нет."))
            }
        }
    }

    private var shiftsSection: some View {
        Section(localized("Your shifts", "Ваши смены")) {
            if viewModel.upcomingShifts.isEmpty {
                emptyRow(localized("No upcoming shifts.", "Предстоящих смен нет."))
            } else {
                infoRow(
                    title: localized(
                        "Shifts assigned: \(viewModel.upcomingShifts.count)",
                        "Назначено смен: \(viewModel.upcomingShifts.count)"
                    ),
                    subtitle: nil
                )
                ForEach(viewModel.upcomingShifts) { shift in
                    infoRow(
                        title: "\(formatDate(shift.date)) · \(minutes(shift.startMinutes))–\(minutes(shift.endMinutes))",
                        subtitle: shift.positionName
                    )
                }
            }
        }
    }

    private var timeOffSection: some View {
        Section(localized("Time off", "Отгулы")) {
            if viewModel.absences.isEmpty {
                emptyRow(localized("No time-off requests.", "Заявок на отгул нет."))
            } else {
                ForEach(viewModel.absences) { absence in
                    infoRow(
                        title: "\(absence.absenceType.title) · \(absence.startDate) – \(absence.endDate)",
                        subtitle: statusLabel(absence.status)
                    )
                }
            }
        }
    }

    private var companySection: some View {
        Section(localized("Company", "Компания")) {
            if let company = viewModel.companyName {
                infoRow(
                    title: localized("You're in company: \(company)", "Вы в компании: \(company)"),
                    subtitle: nil
                )
            } else {
                emptyRow(localized("You're not in a company yet.", "Вы пока не состоите в компании."))
            }
        }
    }

    // MARK: - Rows

    private func infoRow(title: String, subtitle: String?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
            if let subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }
        }
        .padding(.vertical, 2)
        .listRowBackground(themeManager.selectedTheme.cardTint)
    }

    private func emptyRow(_ text: String) -> some View {
        Text(text)
            .font(.footnote)
            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            .listRowBackground(themeManager.selectedTheme.cardTint)
    }

    // MARK: - Formatting

    private func statusLabel(_ status: AppAbsenceStatus?) -> String {
        guard let status else { return localized("Request sent", "Заявка отправлена") }
        return status.title
    }

    private func minutes(_ value: Int) -> String {
        String(format: "%02d:%02d", value / 60, value % 60)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, d MMM"
        return formatter.string(from: date)
    }

    private func formatPeriod(_ start: Date?, _ end: Date?) -> String? {
        guard let start, let end else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM"
        return "\(formatter.string(from: start)) – \(formatter.string(from: end))"
    }
}
