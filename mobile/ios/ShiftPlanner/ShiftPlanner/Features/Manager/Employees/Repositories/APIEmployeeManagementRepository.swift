import Foundation

enum EmployeeManagementRepositoryError: LocalizedError {
    case missingCompany
    case employeeRemovalUnavailable

    var errorDescription: String? {
        switch self {
        case .missingCompany:
            return localized("Company context is missing.", "Не найден контекст компании.")
        case .employeeRemovalUnavailable:
            return localized("The backend does not support removing employees from the company yet.", "Бэкенд пока не поддерживает удаление сотрудников из компании.")
        }
    }
}

private struct EmployeeManagementEmployeeResponseDTO: Decodable {
    let id: Int
    let publicId: String
    let fullName: String
    let email: String
    let role: UserRole
    let branchId: Int?
    let branch: EmployeeManagementBranchSummaryDTO?
    let positionId: Int?
    let positionTitle: String

    enum CodingKeys: String, CodingKey {
        case id
        case publicId = "public_id"
        case fullName = "full_name"
        case email
        case role
        case branchId = "branch_id"
        case branch
        case positionId = "position_id"
        case positionTitle = "position_title"
    }
}

private struct EmployeeManagementBranchSummaryDTO: Decodable {
    let id: Int
    let name: String
}

private struct EmployeeManagementPositionResponseDTO: Decodable {
    let id: Int
    let title: String
    let companyId: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case companyId = "company_id"
    }
}

private struct EmployeeManagementBranchResponseDTO: Decodable {
    let id: Int
    let name: String
    let companyId: Int

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case companyId = "company_id"
    }
}

private struct EmployeeManagementPositionCreateRequestDTO: Encodable {
    let title: String
    let companyId: Int

    enum CodingKeys: String, CodingKey {
        case title
        case companyId = "company_id"
    }
}

private struct EmployeeManagementPositionUpdateRequestDTO: Encodable {
    let positionId: Int?

    enum CodingKeys: String, CodingKey {
        case positionId = "position_id"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(positionId, forKey: .positionId)
    }
}

private struct EmployeeManagementBranchUpdateRequestDTO: Encodable {
    let branchId: Int?

    enum CodingKeys: String, CodingKey {
        case branchId = "branch_id"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(branchId, forKey: .branchId)
    }
}

private struct LinkUserRequestDTO: Encodable {
    let userPublicId: String
    let branchId: Int?
    let positionId: Int?

    enum CodingKeys: String, CodingKey {
        case userPublicId = "user_public_id"
        case branchId = "branch_id"
        case positionId = "position_id"
    }
}

private struct LinkedEmployeeResponseDTO: Decodable {
    let id: Int
    let publicId: String
    let fullName: String
    let email: String
    let branchId: Int?
    let positionId: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case publicId = "public_id"
        case fullName = "full_name"
        case email
        case branchId = "branch_id"
        case positionId = "position_id"
    }

    func asManagedEmployee() -> ManagedEmployee {
        ManagedEmployee(
            id: id,
            publicId: publicId,
            fullName: fullName,
            email: email,
            role: .employee,
            branchId: branchId,
            branchName: nil,
            positionId: positionId,
            positionTitle: nil
        )
    }
}

private struct EmployeeWorkLimitsDTO: Codable {
    let maxHoursPerWeek: Int
    let maxHoursPerDay: Int

    enum CodingKeys: String, CodingKey {
        case maxHoursPerWeek = "max_hours_per_week"
        case maxHoursPerDay = "max_hours_per_day"
    }
}

private struct ManagerRequestDTO: Decodable {
    let id: Int
    let publicId: String
    let fullName: String
    let email: String
    let managerRole: String
    let membershipStatus: String

    enum CodingKeys: String, CodingKey {
        case id
        case publicId = "public_id"
        case fullName = "full_name"
        case email
        case managerRole = "manager_role"
        case membershipStatus = "membership_status"
    }
}

private struct EmployeeRequestDTO: Decodable {
    let id: Int
    let publicId: String
    let fullName: String
    let email: String
    let branchId: Int?
    let positionId: Int?
    let isActive: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case publicId = "public_id"
        case fullName = "full_name"
        case email
        case branchId = "branch_id"
        case positionId = "position_id"
        case isActive = "is_active"
    }
}

extension EmployeeManagementEmployeeResponseDTO {
    func asManagedEmployee() -> ManagedEmployee {
        ManagedEmployee(
            id: id,
            publicId: publicId,
            fullName: fullName,
            email: email,
            role: role,
            branchId: branchId,
            branchName: branch?.name,
            positionId: positionId,
            positionTitle: positionTitle.isEmpty ? nil : positionTitle
        )
    }
}

extension EmployeeManagementPositionResponseDTO {
    func asManagedPosition() -> ManagedPosition {
        ManagedPosition(id: id, title: title)
    }
}

extension EmployeeManagementBranchResponseDTO {
    func asManagedBranch() -> ManagedBranch {
        ManagedBranch(id: id, name: name)
    }
}

final class APIEmployeeManagementRepository: EmployeeManagementRepository {
    let capabilities = EmployeeManagementCapabilities(
        canCreatePosition: true,
        canAssignPosition: true,
        canRemovePosition: true,
        canRemoveEmployee: false
    )

    private let apiClient: APIClient
    private let companyId: Int?

    init(companyId: Int?, apiClient: APIClient = .shared) {
        self.companyId = companyId
        self.apiClient = apiClient
    }

    func fetchEmployees() async throws -> [ManagedEmployee] {
        let request = apiClient.makeRequest(
            path: "employees/",
            method: "GET",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: [EmployeeManagementEmployeeResponseDTO].self)
        return response.map { $0.asManagedEmployee() }
    }

    func fetchBranches() async throws -> [ManagedBranch] {
        let request = apiClient.makeRequest(
            path: "companies/branches",
            method: "GET",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: [EmployeeManagementBranchResponseDTO].self)
        return response.map { $0.asManagedBranch() }
    }

    func fetchPositions() async throws -> [ManagedPosition] {
        guard let companyId else {
            throw EmployeeManagementRepositoryError.missingCompany
        }

        let request = apiClient.makeRequest(
            path: "positions/",
            method: "GET",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: [EmployeeManagementPositionResponseDTO].self)

        return response
            .filter { $0.companyId == companyId }
            .map { $0.asManagedPosition() }
            .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    func addPosition(title: String, currentPositions: [ManagedPosition]) async throws -> [ManagedPosition] {
        guard let companyId else {
            throw EmployeeManagementRepositoryError.missingCompany
        }

        let body = try JSONEncoder().encode(
            EmployeeManagementPositionCreateRequestDTO(
                title: title,
                companyId: companyId
            )
        )
        let request = apiClient.makeRequest(
            path: "positions/",
            method: "POST",
            body: body,
            requiresAuthorization: true
        )
        let created = try await apiClient.send(request, as: EmployeeManagementPositionResponseDTO.self).asManagedPosition()

        var updated = currentPositions
        updated.append(created)
        return updated.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    func removePosition(
        _ position: ManagedPosition,
        from employees: [ManagedEmployee],
        positions: [ManagedPosition]
    ) async throws -> EmployeeManagementSnapshot {
        let request = apiClient.makeRequest(
            path: "positions/\(position.id)",
            method: "DELETE",
            requiresAuthorization: true
        )
        try await apiClient.sendWithoutResponseBody(request)

        return EmployeeManagementSnapshot(
            employees: employees,
            positions: positions.filter { $0.id != position.id }
        )
    }

    func assignBranch(
        _ branchId: Int?,
        to employee: ManagedEmployee,
        in employees: [ManagedEmployee]
    ) async throws -> [ManagedEmployee] {
        let body = try JSONEncoder().encode(
            EmployeeManagementBranchUpdateRequestDTO(branchId: branchId)
        )
        let request = apiClient.makeRequest(
            path: "employees/\(employee.id)/branch",
            method: "PATCH",
            body: body,
            requiresAuthorization: true
        )
        let updatedEmployee = try await apiClient.send(request, as: EmployeeManagementEmployeeResponseDTO.self).asManagedEmployee()

        return employees.map { existingEmployee in
            guard existingEmployee.id == employee.id else { return existingEmployee }
            return updatedEmployee
        }
    }

    func assignPosition(
        _ positionId: Int?,
        to employee: ManagedEmployee,
        in employees: [ManagedEmployee]
    ) async throws -> [ManagedEmployee] {
        let body = try JSONEncoder().encode(
            EmployeeManagementPositionUpdateRequestDTO(positionId: positionId)
        )
        let request = apiClient.makeRequest(
            path: "employees/\(employee.id)/position",
            method: "PATCH",
            body: body,
            requiresAuthorization: true
        )
        let updatedEmployee = try await apiClient.send(request, as: EmployeeManagementEmployeeResponseDTO.self).asManagedEmployee()

        return employees.map { existingEmployee in
            guard existingEmployee.id == employee.id else { return existingEmployee }
            return updatedEmployee
        }
    }

    func removeEmployee(_ employee: ManagedEmployee, from employees: [ManagedEmployee]) async throws -> [ManagedEmployee] {
        employees.filter { $0.id != employee.id }
    }

    // MARK: - Linking

    func linkEmployeeByPublicId(publicId: String, branchId: Int?, positionId: Int?) async throws -> ManagedEmployee {
        let body = try JSONEncoder().encode(
            LinkUserRequestDTO(userPublicId: publicId, branchId: branchId, positionId: positionId)
        )
        let request = apiClient.makeRequest(
            path: "companies/me/link-user",
            method: "POST",
            body: body,
            requiresAuthorization: true
        )
        let linked = try await apiClient.send(request, as: LinkedEmployeeResponseDTO.self)
        return linked.asManagedEmployee()
    }

    // MARK: - Work limits

    func fetchWorkLimits(employeeId: Int) async throws -> WorkLimits {
        let request = apiClient.makeRequest(
            path: "employees/\(employeeId)/work-limits",
            method: "GET",
            requiresAuthorization: true
        )
        let dto = try await apiClient.send(request, as: EmployeeWorkLimitsDTO.self)
        return WorkLimits(maxHoursPerWeek: dto.maxHoursPerWeek, maxHoursPerDay: dto.maxHoursPerDay)
    }

    func updateWorkLimits(employeeId: Int, maxHoursPerWeek: Int, maxHoursPerDay: Int) async throws -> WorkLimits {
        let body = try JSONEncoder().encode(
            EmployeeWorkLimitsDTO(maxHoursPerWeek: maxHoursPerWeek, maxHoursPerDay: maxHoursPerDay)
        )
        let request = apiClient.makeRequest(
            path: "employees/\(employeeId)/work-limits",
            method: "PATCH",
            body: body,
            requiresAuthorization: true
        )
        let dto = try await apiClient.send(request, as: EmployeeWorkLimitsDTO.self)
        return WorkLimits(maxHoursPerWeek: dto.maxHoursPerWeek, maxHoursPerDay: dto.maxHoursPerDay)
    }

    // MARK: - Join requests

    func fetchManagerRequests() async throws -> [PendingManagerRequest] {
        let request = apiClient.makeRequest(
            path: "companies/me/manager-requests",
            method: "GET",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: [ManagerRequestDTO].self)
        return response
            .filter { $0.membershipStatus == "pending" }
            .map {
                PendingManagerRequest(id: $0.id, fullName: $0.fullName, email: $0.email, managerRole: $0.managerRole)
            }
    }

    func acceptManagerRequest(id: Int) async throws {
        try await postWithoutResponse(path: "companies/me/manager-requests/\(id)/accept")
    }

    func declineManagerRequest(id: Int) async throws {
        try await postWithoutResponse(path: "companies/me/manager-requests/\(id)/decline")
    }

    func fetchEmployeeRequests() async throws -> [PendingEmployeeRequest] {
        let request = apiClient.makeRequest(
            path: "companies/me/employee-requests",
            method: "GET",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: [EmployeeRequestDTO].self)
        return response
            .filter { !$0.isActive }
            .map {
                PendingEmployeeRequest(
                    id: $0.id, fullName: $0.fullName, email: $0.email,
                    positionId: $0.positionId, branchId: $0.branchId
                )
            }
    }

    func acceptEmployeeRequest(id: Int) async throws {
        try await postWithoutResponse(path: "companies/me/employee-requests/\(id)/accept")
    }

    func declineEmployeeRequest(id: Int) async throws {
        try await postWithoutResponse(path: "companies/me/employee-requests/\(id)/decline")
    }

    private func postWithoutResponse(path: String) async throws {
        let request = apiClient.makeRequest(
            path: path,
            method: "POST",
            requiresAuthorization: true
        )
        try await apiClient.sendWithoutResponseBody(request)
    }
}
