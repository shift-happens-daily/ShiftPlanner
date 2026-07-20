import Foundation

protocol AbsenceRepository {
    func fetchMyAbsences() async throws -> [AppAbsence]
    func createMyAbsence(
        type: AppAbsenceType,
        startDate: String,
        endDate: String,
        comment: String?
    ) async throws -> AppAbsence

    func fetchEmployeeAbsences(employeeId: Int) async throws -> [AppAbsence]
    func updateAbsence(
        employeeId: Int,
        absenceId: Int,
        type: AppAbsenceType,
        startDate: String,
        endDate: String,
        comment: String?
    ) async throws -> AppAbsence
    func deleteAbsence(employeeId: Int, absenceId: Int) async throws
}

final class APIAbsenceRepository: AbsenceRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func fetchMyAbsences() async throws -> [AppAbsence] {
        let request = apiClient.makeRequest(
            path: "employees/me/absences",
            method: "GET",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: [AbsenceResponseDTO].self)
        return response.map { $0.asAppAbsence() }
    }

    func createMyAbsence(
        type: AppAbsenceType,
        startDate: String,
        endDate: String,
        comment: String?
    ) async throws -> AppAbsence {
        let body = try JSONEncoder().encode(
            AbsenceCreateRequestDTO(
                absenceType: type.rawValue,
                startDate: startDate,
                endDate: endDate,
                comment: comment
            )
        )
        let request = apiClient.makeRequest(
            path: "employees/me/absences",
            method: "POST",
            body: body,
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: AbsenceResponseDTO.self)
        return response.asAppAbsence()
    }

    func fetchEmployeeAbsences(employeeId: Int) async throws -> [AppAbsence] {
        let request = apiClient.makeRequest(
            path: "employees/\(employeeId)/absences",
            method: "GET",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: [AbsenceResponseDTO].self)
        return response.map { $0.asAppAbsence() }
    }

    func updateAbsence(
        employeeId: Int,
        absenceId: Int,
        type: AppAbsenceType,
        startDate: String,
        endDate: String,
        comment: String?
    ) async throws -> AppAbsence {
        let body = try JSONEncoder().encode(
            AbsenceCreateRequestDTO(
                absenceType: type.rawValue,
                startDate: startDate,
                endDate: endDate,
                comment: comment
            )
        )
        let request = apiClient.makeRequest(
            path: "employees/\(employeeId)/absences/\(absenceId)",
            method: "PATCH",
            body: body,
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: AbsenceResponseDTO.self)
        return response.asAppAbsence()
    }

    func deleteAbsence(employeeId: Int, absenceId: Int) async throws {
        let request = apiClient.makeRequest(
            path: "employees/\(employeeId)/absences/\(absenceId)",
            method: "DELETE",
            requiresAuthorization: true
        )
        try await apiClient.sendWithoutResponseBody(request)
    }
}
