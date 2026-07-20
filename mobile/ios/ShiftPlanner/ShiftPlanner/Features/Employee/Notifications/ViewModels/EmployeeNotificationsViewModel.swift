import Foundation
import Combine

/// Aggregates everything an employee should be notified about, derived from
/// the existing endpoints (there is no server-side notification store): a
/// freshly published schedule, shifts assigned to them, the status of their
/// time-off requests, and confirmation that their company membership is active.
@MainActor
final class EmployeeNotificationsViewModel: ObservableObject {
    /// Latest published schedule covering the employee (nil when nothing is published).
    @Published private(set) var publishedSchedule: AppSchedule?
    /// The employee's own upcoming shifts (today onward), sorted by date.
    @Published private(set) var upcomingShifts: [AppScheduledShift] = []
    /// The employee's own time-off requests and their approval status.
    @Published private(set) var absences: [AppAbsence] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    /// Company the employee belongs to — a join was approved when non-nil.
    let companyName: String?

    private let scheduleRepository: ScheduleRepository
    private let absenceRepository: AbsenceRepository

    init(
        companyName: String?,
        scheduleRepository: ScheduleRepository = APIScheduleRepository(),
        absenceRepository: AbsenceRepository = APIAbsenceRepository()
    ) {
        self.companyName = companyName
        self.scheduleRepository = scheduleRepository
        self.absenceRepository = absenceRepository
    }

    func load() async {
        isLoading = true
        errorMessage = nil

        let published = try? await scheduleRepository.fetchLatestSchedule(status: .published)
        let myShifts = (try? await scheduleRepository.fetchMySchedule()) ?? []
        let myAbsences = (try? await absenceRepository.fetchMyAbsences()) ?? []

        let startOfToday = Calendar.current.startOfDay(for: Date())

        publishedSchedule = published
        upcomingShifts = myShifts
            .filter { $0.date >= startOfToday }
            .sorted {
                if $0.date == $1.date { return $0.startMinutes < $1.startMinutes }
                return $0.date < $1.date
            }
        absences = myAbsences.sorted { $0.startDate > $1.startDate }
        isLoading = false
    }
}
