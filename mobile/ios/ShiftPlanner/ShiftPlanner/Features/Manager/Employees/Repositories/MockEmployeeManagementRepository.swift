import Foundation

struct MockEmployeeManagementRepository: EmployeeManagementRepository {
    let capabilities = EmployeeManagementCapabilities(
        canCreatePosition: true,
        canAssignPosition: true,
        canRemovePosition: true,
        canRemoveEmployee: true
    )

    func fetchEmployees(allowedPositionIDs: Set<Int>) async throws -> [ManagedEmployee] {
        let positions = try await fetchPositions()

        return [
            ManagedEmployee(
                id: 1,
                fullName: "Anna Petrova",
                email: "anna@example.com",
                positionId: positions[safe: 0]?.id
            ),
            ManagedEmployee(
                id: 2,
                fullName: "Ivan Smirnov",
                email: "ivan@example.com",
                positionId: positions[safe: 1]?.id
            ),
            ManagedEmployee(
                id: 3,
                fullName: "Maria Sokolova",
                email: "maria@example.com",
                positionId: nil
            )
        ]
    }

    func fetchPositions() async throws -> [ManagedPosition] {
        [
            ManagedPosition(id: 1, title: "Barista"),
            ManagedPosition(id: 2, title: "Waiter"),
            ManagedPosition(id: 3, title: "Shift Lead")
        ]
    }

    func addPosition(title: String, currentPositions: [ManagedPosition]) async throws -> [ManagedPosition] {
        var updatedPositions = currentPositions
        let nextID = (updatedPositions.map(\.id).max() ?? 0) + 1
        updatedPositions.append(ManagedPosition(id: nextID, title: title))
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
        _ positionId: Int?,
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
