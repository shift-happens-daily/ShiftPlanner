import Foundation
import Combine

/// Aggregates everything a manager must act on: shift-exchange requests,
/// time-off requests (scaffolded — no backend approval flow yet), and join
/// requests from new employees and managers.
/// One employee's time-off entry, carried with the owning employee so the
/// manager can act on it.
struct ManagerTimeOffItem: Identifiable, Equatable {
    let employeeId: Int
    let employeeName: String
    let absence: AppAbsence

    var id: String { "\(employeeId)_\(absence.id)" }
}

@MainActor
final class NotificationsViewModel: ObservableObject {
    @Published private(set) var exchangeRequests: [ShiftExchangeRequest] = []
    @Published private(set) var timeOff: [ManagerTimeOffItem] = []
    @Published private(set) var employeeRequests: [PendingEmployeeRequest] = []
    @Published private(set) var managerRequests: [PendingManagerRequest] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let scheduleRepository: ScheduleRepository
    private let employeeRepository: EmployeeManagementRepository
    private let absenceRepository: AbsenceRepository

    init(
        companyId: Int?,
        scheduleRepository: ScheduleRepository = APIScheduleRepository(),
        employeeRepository: EmployeeManagementRepository? = nil,
        absenceRepository: AbsenceRepository = APIAbsenceRepository()
    ) {
        self.scheduleRepository = scheduleRepository
        self.employeeRepository = employeeRepository ?? APIEmployeeManagementRepository(companyId: companyId)
        self.absenceRepository = absenceRepository
    }

    /// Count of actionable items — drives the bell badge.
    var totalCount: Int {
        exchangeRequests.count + timeOff.count + employeeRequests.count + managerRequests.count
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        exchangeRequests = (try? await scheduleRepository.fetchExchangeRequests()) ?? []
        employeeRequests = (try? await employeeRepository.fetchEmployeeRequests()) ?? []
        managerRequests = (try? await employeeRepository.fetchManagerRequests()) ?? []
        timeOff = await loadTimeOff()
        isLoading = false
    }

    /// Collects absences per employee — the backend has no company-wide
    /// absence endpoint, so fan out one request per employee concurrently.
    private func loadTimeOff() async -> [ManagerTimeOffItem] {
        let employees = (try? await employeeRepository.fetchEmployees()) ?? []
        let repository = absenceRepository
        return await withTaskGroup(of: [ManagerTimeOffItem].self) { group in
            for employee in employees {
                group.addTask {
                    let absences = (try? await repository.fetchEmployeeAbsences(employeeId: employee.id)) ?? []
                    return absences.map {
                        ManagerTimeOffItem(employeeId: employee.id, employeeName: employee.fullName, absence: $0)
                    }
                }
            }
            var items: [ManagerTimeOffItem] = []
            for await chunk in group { items.append(contentsOf: chunk) }
            return items.sorted { $0.absence.startDate > $1.absence.startDate }
        }
    }

    func deleteTimeOff(_ item: ManagerTimeOffItem) async {
        await mutate { try await self.absenceRepository.deleteAbsence(employeeId: item.employeeId, absenceId: item.absence.id) }
    }

    func approveExchange(_ request: ShiftExchangeRequest) async {
        await mutate { _ = try await self.scheduleRepository.updateExchangeRequest(id: request.id, approved: true) }
    }

    func rejectExchange(_ request: ShiftExchangeRequest) async {
        await mutate { _ = try await self.scheduleRepository.updateExchangeRequest(id: request.id, approved: false) }
    }

    func acceptEmployee(_ request: PendingEmployeeRequest) async {
        await mutate { try await self.employeeRepository.acceptEmployeeRequest(id: request.id) }
    }

    func declineEmployee(_ request: PendingEmployeeRequest) async {
        await mutate { try await self.employeeRepository.declineEmployeeRequest(id: request.id) }
    }

    func acceptManager(_ request: PendingManagerRequest) async {
        await mutate { try await self.employeeRepository.acceptManagerRequest(id: request.id) }
    }

    func declineManager(_ request: PendingManagerRequest) async {
        await mutate { try await self.employeeRepository.declineManagerRequest(id: request.id) }
    }

    private func mutate(_ action: () async throws -> Void) async {
        do {
            try await action()
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
