import Foundation

protocol AvailabilityRepository {
    func fetchAvailability(employeeId: Int) async throws -> EmployeeAvailabilityResponseDTO
    func saveAvailability(employeeId: Int, payload: EmployeeAvailabilityUpsertDTO) async throws -> EmployeeAvailabilityResponseDTO
}
