import Foundation

struct EmployeeManagementCapabilities {
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
    func addPosition(title: String, currentPositions: [ManagedPosition]) async throws -> [ManagedPosition]
    func removePosition(_ position: ManagedPosition, from employees: [ManagedEmployee], positions: [ManagedPosition]) async throws -> EmployeeManagementSnapshot
    func assignBranch(_ branchId: Int?, to employee: ManagedEmployee, in employees: [ManagedEmployee]) async throws -> [ManagedEmployee]
    func assignPosition(_ positionId: Int?, to employee: ManagedEmployee, in employees: [ManagedEmployee]) async throws -> [ManagedEmployee]
    func removeEmployee(_ employee: ManagedEmployee, from employees: [ManagedEmployee]) async throws -> [ManagedEmployee]

    // MARK: - Depth: linking, work limits, join requests

    /// Links an existing user (by their 16-char public ID) into the company.
    func linkEmployeeByPublicId(publicId: String, branchId: Int?, positionId: Int?) async throws -> ManagedEmployee

    func fetchWorkLimits(employeeId: Int) async throws -> WorkLimits
    func updateWorkLimits(employeeId: Int, maxHoursPerWeek: Int, maxHoursPerDay: Int) async throws -> WorkLimits

    func fetchManagerRequests() async throws -> [PendingManagerRequest]
    func acceptManagerRequest(id: Int) async throws
    func declineManagerRequest(id: Int) async throws

    func fetchEmployeeRequests() async throws -> [PendingEmployeeRequest]
    func acceptEmployeeRequest(id: Int) async throws
    func declineEmployeeRequest(id: Int) async throws
}

struct EmployeeManagementSnapshot {
    let employees: [ManagedEmployee]
    let positions: [ManagedPosition]
}
