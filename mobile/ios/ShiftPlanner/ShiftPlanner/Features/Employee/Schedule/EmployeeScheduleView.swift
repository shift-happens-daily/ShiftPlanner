import SwiftUI

struct EmployeeScheduleView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel: EmployeeScheduleViewModel

    init(user: AppUser) {
        _viewModel = StateObject(wrappedValue: EmployeeScheduleViewModel(user: user))
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 16) {
                    if viewModel.isLoading && !viewModel.hasShifts {
                        ProgressView().padding(.top, 40)
                    } else if viewModel.hasShifts {
                        ScheduleCalendarSectionView(
                            items: viewModel.shifts,
                            sectionTitle: languageManager.text("My shifts", "Мои смены"),
                            dateProvider: { $0.date },
                            rowContent: { shift in shiftRow(shift) }
                        )
                    } else {
                        Text(viewModel.statusMessage ?? languageManager.text(
                            "No published shifts yet.",
                            "Опубликованных смен пока нет."
                        ))
                        .font(.footnote)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 24)
                    }

                    if let errorMessage = viewModel.errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding()
            }
            .background(themeManager.selectedTheme.screenBackground)
            .navigationTitle(languageManager.text("Schedule", "Расписание"))
            .navigationBarTitleDisplayMode(.inline)
            .task { await viewModel.loadScheduleIfNeeded() }
        }
    }

    private func shiftRow(_ shift: AppScheduledShift) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(minutes(shift.startMinutes)) – \(minutes(shift.endMinutes))")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                Text(shift.positionName)
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }
            Spacer()
        }
        .padding(12)
        .background(themeManager.selectedTheme.cardTint)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func minutes(_ value: Int) -> String {
        String(format: "%02d:%02d", value / 60, value % 60)
    }
}
