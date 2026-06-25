import Foundation

struct EmployeeManagementCapabilities {
    let canCreateEmployee: Bool
    let canCreatePosition: Bool
    let canAssignPosition: Bool
    let canRemovePosition: Bool
    let canRemoveEmployee: Bool
}

protocol EmployeeManagementRepository {
    var capabilities: EmployeeManagementCapabilities { get }

    func fetchEmployees() async throws -> [ManagedEmployee]
    func fetchBranches() async throws -> [ManagedBranch]
    func fetchPositions() async throws -> [ManagedPosition]
    func createEmployee(
        fullName: String,
        email: String,
        positionId: Int,
        branchId: Int?,
        existingEmployees: [ManagedEmployee]
    ) async throws -> [ManagedEmployee]
    func addPosition(title: String, currentPositions: [ManagedPosition]) async throws -> [ManagedPosition]
    func removePosition(_ position: ManagedPosition, from employees: [ManagedEmployee], positions: [ManagedPosition]) async throws -> EmployeeManagementSnapshot
    func assignBranch(_ branchId: Int?, to employee: ManagedEmployee, in employees: [ManagedEmployee]) async throws -> [ManagedEmployee]
    func assignPosition(_ positionId: Int?, to employee: ManagedEmployee, in employees: [ManagedEmployee]) async throws -> [ManagedEmployee]
    func removeEmployee(_ employee: ManagedEmployee, from employees: [ManagedEmployee]) async throws -> [ManagedEmployee]
}

struct EmployeeManagementSnapshot {
    let employees: [ManagedEmployee]
    let positions: [ManagedPosition]
}
