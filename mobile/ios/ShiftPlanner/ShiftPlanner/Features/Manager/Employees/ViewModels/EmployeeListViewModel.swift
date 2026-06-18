import Foundation
import Combine

@MainActor
final class EmployeeListViewModel: ObservableObject {
    @Published private(set) var employees: [ManagedEmployee] = []
    @Published private(set) var positions: [ManagedPosition] = []
    @Published var errorMessage: String?
    @Published var statusMessage: String?
    @Published var isLoading = false

    private let repository: EmployeeManagementRepository

    init(repository: EmployeeManagementRepository? = nil) {
        self.repository = repository ?? MockEmployeeManagementRepository()
    }

    var hasEmployees: Bool {
        !employees.isEmpty
    }

    var hasPositions: Bool {
        !positions.isEmpty
    }

    func loadData() async {
        guard employees.isEmpty, positions.isEmpty else { return }

        isLoading = true
        errorMessage = nil

        do {
            async let loadedEmployees = repository.fetchEmployees()
            async let loadedPositions = repository.fetchPositions()

            let (employees, positions) = try await (loadedEmployees, loadedPositions)
            self.positions = positions.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
            self.employees = employees
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func addPosition(title: String, assigningTo employee: ManagedEmployee? = nil) async {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedTitle.isEmpty else {
            errorMessage = "Position title cannot be empty."
            statusMessage = nil
            return
        }

        guard positions.contains(where: { $0.title.caseInsensitiveCompare(trimmedTitle) == .orderedSame }) == false else {
            errorMessage = "This position already exists."
            statusMessage = nil
            return
        }

        do {
            positions = try await repository.addPosition(title: trimmedTitle, currentPositions: positions)
            if let employee,
               let newPosition = positions.first(where: { $0.title.caseInsensitiveCompare(trimmedTitle) == .orderedSame }) {
                employees = try await repository.assignPosition(newPosition.id, to: employee, in: employees)
                statusMessage = "Position added and assigned locally."
            } else {
                statusMessage = "Position added locally."
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
            statusMessage = "Position removed locally."
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = nil
        }
    }

    func assignPosition(_ positionId: UUID?, to employee: ManagedEmployee) async {
        do {
            employees = try await repository.assignPosition(positionId, to: employee, in: employees)
            errorMessage = nil
            statusMessage = "Employee role updated locally."
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = nil
        }
    }

    func removeEmployee(_ employee: ManagedEmployee) async {
        do {
            employees = try await repository.removeEmployee(employee, from: employees)
            errorMessage = nil
            statusMessage = "Employee removed locally."
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = nil
        }
    }

    func positionTitle(for employee: ManagedEmployee) -> String {
        guard let positionId = employee.positionId,
              let position = positions.first(where: { $0.id == positionId }) else {
            return "No role assigned"
        }

        return position.title
    }
}
