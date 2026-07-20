import Foundation
import Combine

@MainActor
final class EmployeeScheduleViewModel: ObservableObject {
    @Published private(set) var shifts: [AppScheduledShift] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var statusMessage: String?
    /// Confirmation shown after a shift-exchange request is sent.
    @Published var exchangeMessage: String?

    private let repository: ScheduleRepository
    private let hasCompany: Bool
    private var didLoadSchedule = false

    init(
        user: AppUser,
        repository: ScheduleRepository? = nil
    ) {
        self.repository = repository ?? APIScheduleRepository()
        self.hasCompany = user.hasCompany && user.employeeId != nil
    }

    var hasShifts: Bool {
        !shifts.isEmpty
    }

    func requestExchange(shiftId: Int, note: String) async {
        do {
            try await repository.createExchangeRequest(shiftId: shiftId, note: note)
            exchangeMessage = localized(
                "Exchange request sent. A manager will review it.",
                "Запрос на обмен отправлен. Менеджер его рассмотрит."
            )
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadScheduleIfNeeded() async {
        guard !didLoadSchedule else { return }
        didLoadSchedule = true
        await loadSchedule()
    }

    func loadSchedule() async {
        guard hasCompany else {
            shifts = []
            statusMessage = localized(
                "Join a company first to see your shifts.",
                "Сначала присоединитесь к компании, чтобы видеть свои смены."
            )
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            shifts = try await repository.fetchMySchedule().sorted {
                if $0.date == $1.date {
                    return $0.startMinutes < $1.startMinutes
                }
                return $0.date < $1.date
            }

            statusMessage = shifts.isEmpty
                ? localized("No published shifts yet.", "Опубликованных смен пока нет.")
                : nil
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}
