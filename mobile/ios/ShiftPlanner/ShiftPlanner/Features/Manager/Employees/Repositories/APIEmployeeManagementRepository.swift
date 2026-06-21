import Foundation

enum EmployeeManagementRepositoryError: LocalizedError {
    case missingCompany
    case positionAssignmentUnavailable
    case positionDeletionUnavailable
    case employeeRemovalUnavailable

    var errorDescription: String? {
        switch self {
        case .missingCompany:
            return localized("Company context is missing.", "Не найден контекст компании.")
        case .positionAssignmentUnavailable:
            return localized("The backend does not support reassigning employee positions yet.", "Бэкенд пока не поддерживает переназначение должности сотруднику.")
        case .positionDeletionUnavailable:
            return localized("The backend does not support deleting positions yet.", "Бэкенд пока не поддерживает удаление должностей.")
        case .employeeRemovalUnavailable:
            return localized("The backend does not support removing employees from the company yet.", "Бэкенд пока не поддерживает удаление сотрудников из компании.")
        }
    }
}

private struct EmployeeManagementEmployeeResponseDTO: Decodable {
    let id: Int
    let fullName: String
    let email: String
    let positionId: Int

    enum CodingKeys: String, CodingKey {
        case id
        case fullName = "full_name"
        case email
        case positionId = "position_id"
    }
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

private struct EmployeeManagementPositionCreateRequestDTO: Encodable {
    let title: String
    let companyId: Int

    enum CodingKeys: String, CodingKey {
        case title
        case companyId = "company_id"
    }
}

extension EmployeeManagementEmployeeResponseDTO {
    func asManagedEmployee() -> ManagedEmployee {
        ManagedEmployee(
            id: id,
            fullName: fullName,
            email: email,
            positionId: positionId > 0 ? positionId : nil
        )
    }
}

extension EmployeeManagementPositionResponseDTO {
    func asManagedPosition() -> ManagedPosition {
        ManagedPosition(id: id, title: title)
    }
}

final class APIEmployeeManagementRepository: EmployeeManagementRepository {
    let capabilities = EmployeeManagementCapabilities(
        canCreatePosition: true,
        canAssignPosition: true,
        canRemovePosition: false,
        canRemoveEmployee: false
    )

    private let apiClient: APIClient
    private let companyId: Int?

    init(companyId: Int?, apiClient: APIClient = .shared) {
        self.companyId = companyId
        self.apiClient = apiClient
    }

    func fetchEmployees(allowedPositionIDs: Set<Int>) async throws -> [ManagedEmployee] {
        let request = apiClient.makeRequest(
            path: "employees/",
            method: "GET",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: [EmployeeManagementEmployeeResponseDTO].self)

        guard !allowedPositionIDs.isEmpty else { return [] }

        return response
            .filter { allowedPositionIDs.contains($0.positionId) }
            .map { $0.asManagedEmployee() }
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
        throw EmployeeManagementRepositoryError.positionDeletionUnavailable
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
        throw EmployeeManagementRepositoryError.employeeRemovalUnavailable
    }
}
