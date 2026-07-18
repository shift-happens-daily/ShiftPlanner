import SwiftUI
import Combine

@MainActor
final class ReportsViewModel: ObservableObject {
    @Published private(set) var reports: [EmployeeReport] = []
    @Published var startDate: Date
    @Published var endDate: Date
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let repository: ReportsRepository
    private var hasLoaded = false

    init(repository: ReportsRepository? = nil, referenceDate: Date = .now) {
        self.repository = repository ?? APIReportsRepository()

        let calendar = Calendar(identifier: .gregorian)
        let components = calendar.dateComponents([.year, .month], from: referenceDate)
        self.startDate = calendar.date(from: components) ?? referenceDate
        self.endDate = referenceDate
    }

    var hasReports: Bool { !reports.isEmpty }

    func loadIfNeeded() async {
        guard !hasLoaded else { return }
        hasLoaded = true
        await load()
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            reports = try await repository.fetchEmployeeReports(startDate: startDate, endDate: endDate)
                .sorted { $0.totalHours > $1.totalHours }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    /// CSV for export — mirrors Android's buildCsv.
    func buildCsv() -> String {
        var lines = ["Employee,Position,Total Shifts,Total Hours"]
        for report in reports {
            lines.append([
                Self.csvEscape(report.fullName),
                Self.csvEscape(report.position),
                String(report.totalShifts),
                String(format: "%.1f", report.totalHours)
            ].joined(separator: ","))
        }
        return lines.joined(separator: "\n") + "\n"
    }

    private static func csvEscape(_ value: String) -> String {
        if value.contains(",") || value.contains("\"") || value.contains("\n") {
            return "\"" + value.replacingOccurrences(of: "\"", with: "\"\"") + "\""
        }
        return value
    }
}

struct ReportsView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel = ReportsViewModel()

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 16) {
                    periodCard

                    if viewModel.isLoading && !viewModel.hasReports {
                        ProgressView().padding(.top, 24)
                    } else if viewModel.hasReports {
                        ForEach(viewModel.reports) { report in
                            reportRow(report)
                        }
                    } else {
                        Text(languageManager.text(
                            "No data for this period.",
                            "Нет данных за этот период."
                        ))
                        .font(.footnote)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 16)
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
            .navigationTitle(languageManager.text("Reports", "Отчёты"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    ShareLink(
                        item: ScheduleCSVExport(csv: viewModel.buildCsv(), fileName: "reports.csv"),
                        preview: SharePreview("reports.csv")
                    ) {
                        Image(systemName: "square.and.arrow.up")
                    }
                    .disabled(!viewModel.hasReports)
                }
            }
            .task { await viewModel.loadIfNeeded() }
        }
    }

    private var periodCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            DatePicker(
                languageManager.text("From", "С"),
                selection: $viewModel.startDate,
                displayedComponents: .date
            )
            DatePicker(
                languageManager.text("To", "По"),
                selection: $viewModel.endDate,
                in: viewModel.startDate...,
                displayedComponents: .date
            )

            Button {
                Task { await viewModel.load() }
            } label: {
                if viewModel.isLoading {
                    ProgressView().frame(maxWidth: .infinity)
                } else {
                    Text(languageManager.text("Show report", "Показать отчёт"))
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(viewModel.isLoading)
        }
        .padding(16)
        .themeCard()
    }

    private func reportRow(_ report: EmployeeReport) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(report.fullName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                Text(report.position.isEmpty
                    ? languageManager.text("No position", "Без должности")
                    : report.position)
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(String(format: "%.1f " + languageManager.text("h", "ч"), report.totalHours))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(themeManager.selectedTheme.accentColor)
                Text("\(report.totalShifts) " + languageManager.text("shifts", "смен"))
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }
        }
        .padding(16)
        .themeCard()
    }
}
