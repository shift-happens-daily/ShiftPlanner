import Foundation

final class APIAvailabilityRepository: AvailabilityRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func fetchAvailability(employeeId: Int) async throws -> EmployeeAvailabilityResponseDTO {
        let request = apiClient.makeRequest(
            path: "employees/\(employeeId)/availability",
            method: "GET",
            requiresAuthorization: true
        )
        return try await apiClient.send(request, as: EmployeeAvailabilityResponseDTO.self)
    }

    func saveAvailability(employeeId: Int, payload: EmployeeAvailabilityUpsertDTO) async throws -> EmployeeAvailabilityResponseDTO {
        let body = try JSONEncoder().encode(payload)
        let request = apiClient.makeRequest(
            path: "employees/\(employeeId)/availability",
            method: "POST",
            body: body,
            requiresAuthorization: true
        )
        return try await apiClient.send(request, as: EmployeeAvailabilityResponseDTO.self)
    }
}
