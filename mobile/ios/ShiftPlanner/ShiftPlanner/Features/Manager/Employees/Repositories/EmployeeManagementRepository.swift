import Foundation

protocol EmployeeManagementRepository {
    func fetchEmployees() async throws -> [ManagedEmployee]
    func fetchPositions() async throws -> [ManagedPosition]
    func addPosition(title: String, currentPositions: [ManagedPosition]) async throws -> [ManagedPosition]
    func removePosition(_ position: ManagedPosition, from employees: [ManagedEmployee], positions: [ManagedPosition]) async throws -> EmployeeManagementSnapshot
    func assignPosition(_ positionId: UUID?, to employee: ManagedEmployee, in employees: [ManagedEmployee]) async throws -> [ManagedEmployee]
    func removeEmployee(_ employee: ManagedEmployee, from employees: [ManagedEmployee]) async throws -> [ManagedEmployee]
}

struct EmployeeManagementSnapshot {
    let employees: [ManagedEmployee]
    let positions: [ManagedPosition]
}
