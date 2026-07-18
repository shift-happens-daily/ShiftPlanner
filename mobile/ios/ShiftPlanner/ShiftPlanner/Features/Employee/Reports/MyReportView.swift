import SwiftUI
import Combine

enum MyReportPeriod: Hashable {
    case week
    case month

    var title: String {
        switch self {
        case .week: return localized("This week", "Эта неделя")
        case .month: return localized("This month", "Этот месяц")
        }
    }
}

@MainActor
final class MyReportViewModel: ObservableObject {
    @Published private(set) var report: MySelfReport?
    @Published var period: MyReportPeriod = .month
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let repository: ReportsRepository
    private let calendar: Calendar
    private var hasLoaded = false

    init(repository: ReportsRepository? = nil) {
        self.repository = repository ?? APIReportsRepository()
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2
        self.calendar = calendar
    }

    var periodRange: (start: Date, end: Date) {
        let today = calendar.startOfDay(for: .now)
        switch period {
        case .week:
            let weekday = calendar.component(.weekday, from: today)
            let daysFromMonday = (weekday - calendar.firstWeekday + 7) % 7
            let start = calendar.date(byAdding: .day, value: -daysFromMonday, to: today) ?? today
            let end = calendar.date(byAdding: .day, value: 6, to: start) ?? today
            return (start, end)
        case .month:
            let components = calendar.dateComponents([.year, .month], from: today)
            let start = calendar.date(from: components) ?? today
            let end = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: start) ?? today
            return (start, end)
        }
    }

    func loadIfNeeded() async {
        guard !hasLoaded else { return }
        hasLoaded = true
        await load()
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        let range = periodRange
        do {
            report = try await repository.fetchMyReport(startDate: range.start, endDate: range.end)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

struct MyReportView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel = MyReportViewModel()

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 16) {
                    Picker("", selection: $viewModel.period) {
                        Text(MyReportPeriod.week.title).tag(MyReportPeriod.week)
                        Text(MyReportPeriod.month.title).tag(MyReportPeriod.month)
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: viewModel.period) { _, _ in
                        Task { await viewModel.load() }
                    }

                    if viewModel.isLoading {
                        ProgressView().padding(.top, 40)
                    } else if let report = viewModel.report {
                        totalsCard(report)
                    } else {
                        Text(languageManager.text(
                            "No data for this period.",
                            "Нет данных за этот период."
                        ))
                        .font(.footnote)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
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
            .navigationTitle(languageManager.text("My report", "Мой отчёт"))
            .navigationBarTitleDisplayMode(.inline)
            .refreshable { await viewModel.load() }
            .task { await viewModel.loadIfNeeded() }
        }
    }

    private func totalsCard(_ report: MySelfReport) -> some View {
        HStack(spacing: 12) {
            statTile(
                value: String(format: "%.1f", report.totalHours),
                label: languageManager.text("Hours", "Часы")
            )
            statTile(
                value: "\(report.totalShifts)",
                label: languageManager.text("Shifts", "Смены")
            )
        }
    }

    private func statTile(value: String, label: String) -> some View {
        VStack(spacing: 6) {
            Text(value)
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .foregroundStyle(themeManager.selectedTheme.accentColor)
            Text(label)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .themeCard()
    }
}
