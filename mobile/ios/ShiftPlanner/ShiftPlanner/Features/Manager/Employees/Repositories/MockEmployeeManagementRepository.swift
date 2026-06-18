import Foundation

struct MockEmployeeManagementRepository: EmployeeManagementRepository {
    func fetchEmployees() async throws -> [ManagedEmployee] {
        let positions = try await fetchPositions()

        return [
            ManagedEmployee(
                fullName: "Anna Petrova",
                email: "anna@example.com",
                positionId: positions[safe: 0]?.id
            ),
            ManagedEmployee(
                fullName: "Ivan Smirnov",
                email: "ivan@example.com",
                positionId: positions[safe: 1]?.id
            ),
            ManagedEmployee(
                fullName: "Maria Sokolova",
                email: "maria@example.com",
                positionId: nil
            )
        ]
    }

    func fetchPositions() async throws -> [ManagedPosition] {
        [
            ManagedPosition(title: "Barista"),
            ManagedPosition(title: "Waiter"),
            ManagedPosition(title: "Shift Lead")
        ]
    }

    func addPosition(title: String, currentPositions: [ManagedPosition]) async throws -> [ManagedPosition] {
        var updatedPositions = currentPositions
        updatedPositions.append(ManagedPosition(title: title))
        return updatedPositions.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    func removePosition(
        _ position: ManagedPosition,
        from employees: [ManagedEmployee],
        positions: [ManagedPosition]
    ) async throws -> EmployeeManagementSnapshot {
        let updatedPositions = positions.filter { $0.id != position.id }
        let updatedEmployees = employees.map { employee in
            var mutableEmployee = employee
            if mutableEmployee.positionId == position.id {
                mutableEmployee.positionId = nil
            }
            return mutableEmployee
        }

        return EmployeeManagementSnapshot(
            employees: updatedEmployees,
            positions: updatedPositions
        )
    }

    func assignPosition(
        _ positionId: UUID?,
        to employee: ManagedEmployee,
        in employees: [ManagedEmployee]
    ) async throws -> [ManagedEmployee] {
        employees.map { existingEmployee in
            guard existingEmployee.id == employee.id else { return existingEmployee }
            var mutableEmployee = existingEmployee
            mutableEmployee.positionId = positionId
            return mutableEmployee
        }
    }

    func removeEmployee(_ employee: ManagedEmployee, from employees: [ManagedEmployee]) async throws -> [ManagedEmployee] {
        employees.filter { $0.id != employee.id }
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
