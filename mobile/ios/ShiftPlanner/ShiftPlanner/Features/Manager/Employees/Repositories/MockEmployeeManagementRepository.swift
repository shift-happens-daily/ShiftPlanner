import Foundation

struct MockEmployeeManagementRepository: EmployeeManagementRepository {
    let capabilities = EmployeeManagementCapabilities(
        canCreateEmployee: true,
        canCreatePosition: true,
        canAssignPosition: true,
        canRemovePosition: true,
        canRemoveEmployee: true
    )

    func fetchEmployees() async throws -> [ManagedEmployee] {
        let branches = try await fetchBranches()
        let positions = try await fetchPositions()

        return [
            ManagedEmployee(
                id: 1,
                publicId: "EMPLOYEE00000001",
                fullName: "Anna Petrova",
                email: "anna@example.com",
                role: .employee,
                branchId: branches[safe: 0]?.id,
                branchName: branches[safe: 0]?.name,
                positionId: positions[safe: 0]?.id
            ),
            ManagedEmployee(
                id: 2,
                publicId: "EMPLOYEE00000002",
                fullName: "Ivan Smirnov",
                email: "ivan@example.com",
                role: .employee,
                branchId: branches[safe: 1]?.id,
                branchName: branches[safe: 1]?.name,
                positionId: positions[safe: 1]?.id
            ),
            ManagedEmployee(
                id: 3,
                publicId: "EMPLOYEE00000003",
                fullName: "Maria Sokolova",
                email: "maria@example.com",
                role: .employee,
                branchId: nil,
                branchName: nil,
                positionId: nil
            )
        ]
    }

    func fetchBranches() async throws -> [ManagedBranch] {
        [
            ManagedBranch(id: 1, name: "Main Branch"),
            ManagedBranch(id: 2, name: "Downtown")
        ]
    }

    func fetchPositions() async throws -> [ManagedPosition] {
        [
            ManagedPosition(id: 1, title: "Barista"),
            ManagedPosition(id: 2, title: "Waiter"),
            ManagedPosition(id: 3, title: "Shift Lead")
        ]
    }

    func createEmployee(
        fullName: String,
        email: String,
        positionId: Int,
        branchId: Int?,
        existingEmployees: [ManagedEmployee]
    ) async throws -> [ManagedEmployee] {
        let branches = try await fetchBranches()
        let positions = try await fetchPositions()
        let nextID = (existingEmployees.map(\.id).max() ?? 0) + 1

        let newEmployee = ManagedEmployee(
            id: nextID,
            publicId: "EMPLOYEE\(String(format: "%08d", nextID))",
            fullName: fullName,
            email: email,
            role: .employee,
            branchId: branchId,
            branchName: branches.first(where: { $0.id == branchId })?.name,
            positionId: positionId,
            positionTitle: positions.first(where: { $0.id == positionId })?.title
        )

        return (existingEmployees + [newEmployee]).sorted {
            $0.fullName.localizedCaseInsensitiveCompare($1.fullName) == .orderedAscending
        }
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

    func assignBranch(
        _ branchId: Int?,
        to employee: ManagedEmployee,
        in employees: [ManagedEmployee]
    ) async throws -> [ManagedEmployee] {
        let branches = try await fetchBranches()

        return employees.map { existingEmployee in
            guard existingEmployee.id == employee.id else { return existingEmployee }
            var mutableEmployee = existingEmployee
            mutableEmployee.branchId = branchId
            mutableEmployee.branchName = branches.first(where: { $0.id == branchId })?.name
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
