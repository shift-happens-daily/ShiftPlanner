import Foundation
import Combine

@MainActor
final class ManagerScheduleViewModel: ObservableObject {
    @Published var startDate: Date
    @Published var endDate: Date
    @Published private(set) var schedule: AppSchedule?
    @Published var isLoading = false
    @Published var isGenerating = false
    @Published var isPublishing = false
    @Published var errorMessage: String?
    @Published var statusMessage: String?

    private let repository: ScheduleRepository
    private let hasCompany: Bool
    private var didLoadSchedule = false

    init(
        user: AppUser,
        repository: ScheduleRepository? = nil,
        referenceDate: Date = .now
    ) {
        self.repository = repository ?? APIScheduleRepository()
        self.hasCompany = user.hasCompany

        let calendar = Calendar(identifier: .gregorian)
        let monthComponents = calendar.dateComponents([.year, .month], from: referenceDate)
        let monthStart = calendar.date(from: monthComponents) ?? referenceDate
        let monthEnd = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: monthStart) ?? referenceDate

        self.startDate = monthStart
        self.endDate = monthEnd
    }

    var canGenerate: Bool {
        hasCompany && !isGenerating && !isPublishing && startDate <= endDate
    }

    var canPublish: Bool {
        hasCompany && !isGenerating && !isPublishing && schedule?.status == .draft
    }

    var hasSchedule: Bool {
        schedule != nil
    }

    var scheduleTitle: String {
        guard let schedule else {
            return localized("No schedule generated yet", "Расписание пока не сгенерировано")
        }
        return localized("Schedule #\(schedule.id)", "Расписание №\(schedule.id)")
    }

    func loadScheduleIfNeeded() async {
        guard !didLoadSchedule else { return }
        didLoadSchedule = true
        await loadLatestSchedule()
    }

    func loadLatestSchedule() async {
        guard hasCompany else {
            schedule = nil
            statusMessage = localized(
                "Create or join a company first to generate schedules.",
                "Сначала создайте компанию или присоединитесь к ней, чтобы генерировать расписание."
            )
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            if let draftSchedule = try await repository.fetchLatestSchedule(status: .draft) {
                schedule = draftSchedule
                statusMessage = localized("Latest draft schedule loaded.", "Загружен последний черновик расписания.")
            } else if let publishedSchedule = try await repository.fetchLatestSchedule(status: .published) {
                schedule = publishedSchedule
                statusMessage = localized("Latest published schedule loaded.", "Загружено последнее опубликованное расписание.")
            } else {
                schedule = nil
                statusMessage = localized(
                    "Generate a schedule after requirements and availability are filled in.",
                    "Сгенерируйте расписание после заполнения требований и доступности."
                )
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func generateSchedule() async {
        guard canGenerate else { return }

        isGenerating = true
        errorMessage = nil
        statusMessage = nil

        do {
            schedule = try await repository.generateSchedule(startDate: startDate, endDate: endDate)
            statusMessage = localized("Schedule generated successfully.", "Расписание успешно сгенерировано.")
        } catch {
            errorMessage = error.localizedDescription
        }

        isGenerating = false
    }

    func publishSchedule() async {
        guard canPublish, let schedule else { return }

        isPublishing = true
        errorMessage = nil
        statusMessage = nil

        do {
            self.schedule = try await repository.publishSchedule(scheduleId: schedule.id)
            statusMessage = localized("Schedule published successfully.", "Расписание успешно опубликовано.")
        } catch {
            errorMessage = error.localizedDescription
        }

        isPublishing = false
    }
}
