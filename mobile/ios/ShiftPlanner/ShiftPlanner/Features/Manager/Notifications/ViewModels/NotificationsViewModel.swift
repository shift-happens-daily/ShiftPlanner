import Foundation
import Combine

/// Aggregates everything a manager must act on: shift-exchange requests,
/// time-off requests (scaffolded — no backend approval flow yet), and join
/// requests from new employees and managers.
@MainActor
final class NotificationsViewModel: ObservableObject {
    @Published private(set) var exchangeRequests: [ShiftExchangeRequest] = []
    @Published private(set) var employeeRequests: [PendingEmployeeRequest] = []
    @Published private(set) var managerRequests: [PendingManagerRequest] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let scheduleRepository: ScheduleRepository
    private let employeeRepository: EmployeeManagementRepository

    init(
        companyId: Int?,
        scheduleRepository: ScheduleRepository = APIScheduleRepository(),
        employeeRepository: EmployeeManagementRepository? = nil
    ) {
        self.scheduleRepository = scheduleRepository
        self.employeeRepository = employeeRepository ?? APIEmployeeManagementRepository(companyId: companyId)
    }

    /// Count of actionable items — drives the bell badge.
    var totalCount: Int {
        exchangeRequests.count + employeeRequests.count + managerRequests.count
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        exchangeRequests = (try? await scheduleRepository.fetchExchangeRequests()) ?? []
        employeeRequests = (try? await employeeRepository.fetchEmployeeRequests()) ?? []
        managerRequests = (try? await employeeRepository.fetchManagerRequests()) ?? []
        isLoading = false
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
