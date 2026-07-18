import Foundation
import Combine

@MainActor
final class EmployeeListViewModel: ObservableObject {
    @Published private(set) var employees: [ManagedEmployee] = []
    @Published private(set) var branches: [ManagedBranch] = []
    @Published private(set) var positions: [ManagedPosition] = []
    @Published private(set) var managerRequests: [PendingManagerRequest] = []
    @Published private(set) var employeeRequests: [PendingEmployeeRequest] = []
    @Published var errorMessage: String?
    @Published var statusMessage: String?
    @Published var isLoading = false

    private let repository: EmployeeManagementRepository
    private var hasLoaded = false

    init(repository: EmployeeManagementRepository? = nil) {
        self.repository = repository ?? MockEmployeeManagementRepository()
    }

    var capabilities: EmployeeManagementCapabilities {
        repository.capabilities
    }

    var hasEmployees: Bool { !employees.isEmpty }
    var hasPositions: Bool { !positions.isEmpty }
    var hasPendingRequests: Bool { !managerRequests.isEmpty || !employeeRequests.isEmpty }

    func loadData() async {
        // Runs exactly once per view model. A plain "is data empty" guard would
        // let SwiftUI re-run this via .task for an empty company (no employees /
        // positions), leaving isLoading stuck true → an endless spinner.
        guard !hasLoaded else { return }
        hasLoaded = true

        isLoading = true
        errorMessage = nil

        do {
            let branches = try await repository.fetchBranches()
            self.branches = branches.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            let positions = try await repository.fetchPositions()
            self.positions = positions.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
            let employees = try await repository.fetchEmployees()
            self.employees = employees
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
        await loadRequests()
    }

    /// Force a fresh load (e.g. pull-to-refresh or after an error).
    func reload() async {
        hasLoaded = false
        await loadData()
    }

    func loadRequests() async {
        managerRequests = (try? await repository.fetchManagerRequests()) ?? []
        employeeRequests = (try? await repository.fetchEmployeeRequests()) ?? []
    }

    private func reloadEmployees() async {
        if let fresh = try? await repository.fetchEmployees() {
            employees = fresh
        }
    }

    func addPosition(title: String, assigningTo employee: ManagedEmployee? = nil) async {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedTitle.isEmpty else {
            errorMessage = localized("Position title cannot be empty.", "Название должности не может быть пустым.")
            statusMessage = nil
            return
        }

        guard positions.contains(where: { $0.title.caseInsensitiveCompare(trimmedTitle) == .orderedSame }) == false else {
            errorMessage = localized("This position already exists.", "Такая должность уже существует.")
            statusMessage = nil
            return
        }

        do {
            positions = try await repository.addPosition(title: trimmedTitle, currentPositions: positions)
            if let employee,
               capabilities.canAssignPosition,
               let newPosition = positions.first(where: { $0.title.caseInsensitiveCompare(trimmedTitle) == .orderedSame }) {
                employees = try await repository.assignPosition(newPosition.id, to: employee, in: employees)
                statusMessage = localized("Position added and assigned.", "Должность добавлена и назначена.")
            } else {
                statusMessage = capabilities.canAssignPosition
                    ? localized("Position added.", "Должность добавлена.")
                    : localized(
                        "Position added. Backend assignment for employees is not supported yet.",
                        "Должность добавлена. Бэкенд пока не поддерживает назначение должности сотруднику."
                    )
            }
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = nil
        }
    }

    func removePosition(_ position: ManagedPosition) async {
        do {
            let snapshot = try await repository.removePosition(
                position,
                from: employees,
                positions: positions
            )
            employees = snapshot.employees
            positions = snapshot.positions
            errorMessage = nil
            statusMessage = localized("Position removed.", "Должность удалена.")
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = nil
        }
    }

    func assignPosition(_ positionId: Int?, to employee: ManagedEmployee) async {
        do {
            employees = try await repository.assignPosition(positionId, to: employee, in: employees)
            errorMessage = nil
            statusMessage = localized("Employee role updated.", "Роль сотрудника обновлена.")
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = nil
        }
    }

    func assignBranch(_ branchId: Int?, to employee: ManagedEmployee) async {
        do {
            employees = try await repository.assignBranch(branchId, to: employee, in: employees)
            errorMessage = nil
            statusMessage = localized("Employee branch updated.", "Филиал сотрудника обновлен.")
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = nil
        }
    }

    func removeEmployee(_ employee: ManagedEmployee) async {
        do {
            employees = try await repository.removeEmployee(employee, from: employees)
            errorMessage = nil
            statusMessage = localized("Employee removed.", "Сотрудник удален.")
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = nil
        }
    }

    // MARK: - Linking

    func linkEmployee(publicId: String, branchId: Int?, positionId: Int?) async {
        let trimmed = publicId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            errorMessage = localized("Enter the employee's ID.", "Введите ID сотрудника.")
            statusMessage = nil
            return
        }
        do {
            _ = try await repository.linkEmployeeByPublicId(publicId: trimmed, branchId: branchId, positionId: positionId)
            await reloadEmployees()
            errorMessage = nil
            statusMessage = localized("Employee linked to the company.", "Сотрудник привязан к компании.")
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = nil
        }
    }

    // MARK: - Work limits

    func workLimits(for employeeId: Int) async -> WorkLimits? {
        do {
            return try await repository.fetchWorkLimits(employeeId: employeeId)
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func updateWorkLimits(employeeId: Int, maxHoursPerWeek: Int, maxHoursPerDay: Int) async {
        do {
            _ = try await repository.updateWorkLimits(
                employeeId: employeeId,
                maxHoursPerWeek: maxHoursPerWeek,
                maxHoursPerDay: maxHoursPerDay
            )
            errorMessage = nil
            statusMessage = localized("Work limits updated.", "Лимиты работы обновлены.")
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = nil
        }
    }

    // MARK: - Join requests

    func acceptManagerRequest(_ request: PendingManagerRequest) async {
        do {
            try await repository.acceptManagerRequest(id: request.id)
            await loadRequests()
            errorMessage = nil
            statusMessage = localized("Request accepted.", "Заявка принята.")
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = nil
        }
    }

    func declineManagerRequest(_ request: PendingManagerRequest) async {
        do {
            try await repository.declineManagerRequest(id: request.id)
            await loadRequests()
            errorMessage = nil
            statusMessage = localized("Request declined.", "Заявка отклонена.")
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = nil
        }
    }

    func acceptEmployeeRequest(_ request: PendingEmployeeRequest) async {
        do {
            try await repository.acceptEmployeeRequest(id: request.id)
            await loadRequests()
            await reloadEmployees()
            errorMessage = nil
            statusMessage = localized("Request accepted.", "Заявка принята.")
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = nil
        }
    }

    func declineEmployeeRequest(_ request: PendingEmployeeRequest) async {
        do {
            try await repository.declineEmployeeRequest(id: request.id)
            await loadRequests()
            errorMessage = nil
            statusMessage = localized("Request declined.", "Заявка отклонена.")
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = nil
        }
    }

    func positionTitle(for employee: ManagedEmployee) -> String {
        guard let positionId = employee.positionId,
              let position = positions.first(where: { $0.id == positionId }) else {
            return employee.positionTitle ?? localized("No role assigned", "Без должности")
        }

        return position.title
    }

    func branchTitle(for employee: ManagedEmployee) -> String {
        guard let branchId = employee.branchId,
              let branch = branches.first(where: { $0.id == branchId }) else {
            return employee.branchName ?? localized("No branch", "Без филиала")
        }

        return branch.name
    }
}
