import Foundation

final class APIScheduleRepository: ScheduleRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func generateSchedule(startDate: Date, endDate: Date) async throws -> AppSchedule {
        let payload = ScheduleGenerateRequestDTO(
            startDate: Self.dateFormatter.string(from: startDate),
            endDate: Self.dateFormatter.string(from: endDate)
        )
        let body = try JSONEncoder().encode(payload)
        let request = apiClient.makeRequest(
            path: "schedule/generate",
            method: "POST",
            body: body,
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: ScheduleResponseDTO.self)
        return try mapSchedule(response)
    }

    func fetchSchedule(scheduleId: Int) async throws -> AppSchedule {
        let request = apiClient.makeRequest(
            path: "schedule/\(scheduleId)",
            method: "GET",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: ScheduleResponseDTO.self)
        return try mapSchedule(response)
    }

    func fetchLatestSchedule(status: AppScheduleStatus?) async throws -> AppSchedule? {
        let baseURL = apiClient.baseURL.appendingPathComponent("schedule/latest")
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        if let status {
            components?.queryItems = [URLQueryItem(name: "status", value: status.rawValue)]
        }

        guard let url = components?.url else {
            throw APIClientError.invalidResponse
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let accessToken = apiClient.accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIClientError.requestFailed(message: error.localizedDescription)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }

        if httpResponse.statusCode == 404 {
            return nil
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            if let errorResponse = try? JSONDecoder().decode(APIErrorResponse.self, from: data),
               let detail = errorResponse.detail,
               !detail.isEmpty {
                throw APIClientError.requestFailed(message: detail)
            }

            throw APIClientError.requestFailed(
                message: LanguageManager.localizedFormat(
                    "Request failed with status code %d.",
                    "Запрос завершился с кодом %d.",
                    httpResponse.statusCode
                )
            )
        }

        let responseDTO: ScheduleResponseDTO
        do {
            responseDTO = try JSONDecoder().decode(ScheduleResponseDTO.self, from: data)
        } catch {
            throw APIClientError.decodingFailed
        }

        return try mapSchedule(responseDTO)
    }

    func publishSchedule(scheduleId: Int) async throws -> AppSchedule {
        let request = apiClient.makeRequest(
            path: "schedule/\(scheduleId)/publish",
            method: "POST",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: ScheduleResponseDTO.self)
        return try mapSchedule(response)
    }

    func fetchMySchedule() async throws -> [AppScheduledShift] {
        let request = apiClient.makeRequest(
            path: "schedule/my",
            method: "GET",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: [ScheduleShiftResponseDTO].self)
        return try response.map(mapShift)
    }

    func fetchAvailableEmployees(
        scheduleId: Int,
        shift: AppScheduledShift
    ) async throws -> [AppAvailableEmployee] {
        let baseURL = apiClient.baseURL.appendingPathComponent("schedule/\(scheduleId)/employees/available")
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "date", value: Self.dateFormatter.string(from: shift.date)),
            URLQueryItem(name: "start_time", value: Self.timeString(from: shift.startMinutes)),
            URLQueryItem(name: "end_time", value: Self.timeString(from: shift.endMinutes)),
            URLQueryItem(name: "position_id", value: String(shift.positionId))
        ]

        guard let url = components?.url else {
            throw APIClientError.invalidResponse
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let accessToken = apiClient.accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        let response = try await apiClient.send(request, as: [AvailableEmployeeResponseDTO].self)
        return try response.map(mapAvailableEmployee)
    }

    func assignRequirement(
        scheduleId: Int,
        requirementId: Int,
        employeeId: Int
    ) async throws -> AppSchedule {
        let body = try JSONEncoder().encode(
            RequirementAssignRequestDTO(employeeId: employeeId)
        )
        let request = apiClient.makeRequest(
            path: "schedule/\(scheduleId)/requirements/\(requirementId)/assign",
            method: "POST",
            body: body,
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: ScheduleResponseDTO.self)
        return try mapSchedule(response)
    }

    func updateShift(
        scheduleId: Int,
        shiftId: Int,
        action: ScheduleShiftUpdateAction
    ) async throws -> AppSchedule {
        let payload: ScheduleShiftUpdateRequestDTO
        switch action {
        case .reassign(let employeeId):
            payload = ScheduleShiftUpdateRequestDTO(
                action: "reassign",
                employeeId: employeeId
            )
        case .remove:
            let request = apiClient.makeRequest(
                path: "schedule/\(scheduleId)/shifts/\(shiftId)",
                method: "DELETE",
                requiresAuthorization: true
            )
            try await apiClient.sendWithoutResponseBody(request)
            return try await fetchSchedule(scheduleId: scheduleId)
        }

        let body = try JSONEncoder().encode(payload)
        let request = apiClient.makeRequest(
            path: "schedule/\(scheduleId)/shifts/\(shiftId)",
            method: "PATCH",
            body: body,
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: ScheduleResponseDTO.self)
        return try mapSchedule(response)
    }

    private func mapSchedule(_ dto: ScheduleResponseDTO) throws -> AppSchedule {
        guard let status = AppScheduleStatus(rawValue: dto.status) else {
            throw APIClientError.decodingFailed
        }

        return AppSchedule(
            id: dto.id,
            status: status,
            shifts: try dto.shifts.map(mapShift),
            unfilledRequirements: try dto.unfilledRequirements.map(mapUnfilledRequirement)
        )
    }

    private func mapShift(_ dto: ScheduleShiftResponseDTO) throws -> AppScheduledShift {
        guard let date = Self.dateFormatter.date(from: dto.date) else {
            throw APIClientError.decodingFailed
        }

        return AppScheduledShift(
            id: dto.id,
            employeeId: dto.employeeId,
            employeeName: dto.employeeName,
            positionId: dto.positionId,
            positionName: dto.position,
            date: date,
            startMinutes: Self.minutes(from: dto.startTime),
            endMinutes: Self.minutes(from: dto.endTime)
        )
    }

    private func mapUnfilledRequirement(_ dto: ScheduleUnfilledRequirementResponseDTO) throws -> AppUnfilledRequirement {
        guard let date = Self.dateFormatter.date(from: dto.date) else {
            throw APIClientError.decodingFailed
        }

        return AppUnfilledRequirement(
            id: dto.requirementId,
            positionId: dto.positionId,
            positionTitle: dto.positionTitle,
            date: date,
            startMinutes: Self.minutes(from: dto.startTime),
            endMinutes: Self.minutes(from: dto.endTime),
            missingStaff: dto.missingStaff
        )
    }

    private func mapAvailableEmployee(_ dto: AvailableEmployeeResponseDTO) throws -> AppAvailableEmployee {
        guard let availabilityStatus = AppEmployeeAvailabilityStatus(rawValue: dto.availabilityStatus) else {
            throw APIClientError.decodingFailed
        }

        return AppAvailableEmployee(
            id: dto.id,
            fullName: dto.fullName,
            positionName: dto.position.name,
            branchName: dto.branch?.name,
            availabilityStatus: availabilityStatus,
            assignedHours: dto.assignedHours
        )
    }

    private static func minutes(from timeString: String) -> Int {
        let parts = timeString.split(separator: ":").compactMap { Int($0) }
        guard parts.count >= 2 else { return 0 }
        return (parts[0] * 60) + parts[1]
    }

    private static func timeString(from minutes: Int) -> String {
        let hour = minutes / 60
        let minute = minutes % 60
        return String(format: "%02d:%02d:00", hour, minute)
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .autoupdatingCurrent
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
