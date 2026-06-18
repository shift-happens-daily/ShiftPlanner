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
               let newPosition = positions.first(where: { $0.title.caseInsensitiveCompare(trimmedTitle) == .orderedSame }) {
                employees = try await repository.assignPosition(newPosition.id, to: employee, in: employees)
                statusMessage = localized("Position added and assigned locally.", "Должность добавлена и назначена локально.")
            } else {
                statusMessage = localized("Position added locally.", "Должность добавлена локально.")
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
            statusMessage = localized("Position removed locally.", "Должность удалена локально.")
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = nil
        }
    }

    func assignPosition(_ positionId: UUID?, to employee: ManagedEmployee) async {
        do {
            employees = try await repository.assignPosition(positionId, to: employee, in: employees)
            errorMessage = nil
            statusMessage = localized("Employee role updated locally.", "Роль сотрудника обновлена локально.")
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = nil
        }
    }

    func removeEmployee(_ employee: ManagedEmployee) async {
        do {
            employees = try await repository.removeEmployee(employee, from: employees)
            errorMessage = nil
            statusMessage = localized("Employee removed locally.", "Сотрудник удален локально.")
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = nil
        }
    }

    func positionTitle(for employee: ManagedEmployee) -> String {
        guard let positionId = employee.positionId,
              let position = positions.first(where: { $0.id == positionId }) else {
            return localized("No role assigned", "Без должности")
        }

        return position.title
    }
}
