import Foundation

enum EmployeeManagementRepositoryError: LocalizedError {
    case missingCompany

    var errorDescription: String? {
        switch self {
        case .missingCompany:
            return localized("Company context is missing.", "Не найден контекст компании.")
        }
    }
}

private struct EmployeeManagementEmployeeCreateRequestDTO: Encodable {
    let fullName: String
    let email: String
    let positionId: Int

    enum CodingKeys: String, CodingKey {
        case fullName = "full_name"
        case email
        case positionId = "position_id"
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
    let position: EmployeeManagementPositionSummaryDTO?

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
        case position
    }
}

private struct EmployeeManagementBranchSummaryDTO: Decodable {
    let id: Int
    let name: String
}

private struct EmployeeManagementPositionSummaryDTO: Decodable {
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

extension EmployeeManagementEmployeeResponseDTO {
    func asManagedEmployee() -> ManagedEmployee {
        let resolvedPositionId = positionId ?? position?.id
        let resolvedPositionTitle: String? = {
            if !positionTitle.isEmpty {
                return positionTitle
            }

            if let nestedName = position?.name, !nestedName.isEmpty {
                return nestedName
            }

            return nil
        }()

        return ManagedEmployee(
            id: id,
            publicId: publicId,
            fullName: fullName,
            email: email,
            role: role,
            branchId: branchId,
            branchName: branch?.name,
            positionId: resolvedPositionId,
            positionTitle: resolvedPositionTitle
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
        canCreateEmployee: true,
        canCreatePosition: true,
        canAssignPosition: true,
        canRemovePosition: true,
        canRemoveEmployee: true
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

    func createEmployee(
        fullName: String,
        email: String,
        positionId: Int,
        branchId: Int?,
        existingEmployees: [ManagedEmployee]
    ) async throws -> [ManagedEmployee] {
        let body = try JSONEncoder().encode(
            EmployeeManagementEmployeeCreateRequestDTO(
                fullName: fullName,
                email: email,
                positionId: positionId
            )
        )

        let request = apiClient.makeRequest(
            path: "employees/",
            method: "POST",
            body: body,
            requiresAuthorization: true
        )
        var createdEmployee = try await apiClient.send(
            request,
            as: EmployeeManagementEmployeeResponseDTO.self
        ).asManagedEmployee()

        if let branchId {
            let body = try JSONEncoder().encode(
                EmployeeManagementBranchUpdateRequestDTO(branchId: branchId)
            )
            let branchRequest = apiClient.makeRequest(
                path: "employees/\(createdEmployee.id)/branch",
                method: "PATCH",
                body: body,
                requiresAuthorization: true
            )
            createdEmployee = try await apiClient.send(
                branchRequest,
                as: EmployeeManagementEmployeeResponseDTO.self
            ).asManagedEmployee()
        }

        return (existingEmployees + [createdEmployee]).sorted {
            $0.fullName.localizedCaseInsensitiveCompare($1.fullName) == .orderedAscending
        }
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
        let request = apiClient.makeRequest(
            path: "employees/\(employee.id)",
            method: "DELETE",
            requiresAuthorization: true
        )
        try await apiClient.sendWithoutResponseBody(request)
        return employees.filter { $0.id != employee.id }
    }
}
