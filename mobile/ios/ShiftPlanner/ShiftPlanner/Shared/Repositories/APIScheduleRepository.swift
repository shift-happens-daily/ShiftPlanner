import Foundation

final class APIScheduleRepository: ScheduleRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - Generate / fetch

    func generateSchedule(startDate: Date, endDate: Date, branchId: Int?) async throws -> [AppSchedule] {
        let payload = ScheduleGenerateRequestDTO(
            startDate: Self.dateFormatter.string(from: startDate),
            endDate: Self.dateFormatter.string(from: endDate),
            branchId: branchId
        )
        let body = try JSONEncoder().encode(payload)
        let request = apiClient.makeRequest(
            path: "schedule/generate",
            method: "POST",
            body: body,
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: ScheduleGenerateResponseDTO.self)
        return try response.schedules.map(mapSchedule)
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
        var queryItems: [URLQueryItem] = []
        if let status {
            queryItems.append(URLQueryItem(name: "status", value: status.rawValue))
        }
        let request = authorizedGetRequest(path: "schedule/latest", queryItems: queryItems)

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

    func fetchSchedules(
        startDate: Date?,
        endDate: Date?,
        branchId: Int?,
        status: AppScheduleStatus?
    ) async throws -> [AppScheduleListItem] {
        var queryItems: [URLQueryItem] = []
        if let branchId {
            queryItems.append(URLQueryItem(name: "branch_id", value: String(branchId)))
        }
        if let startDate {
            queryItems.append(URLQueryItem(name: "start_date", value: Self.dateFormatter.string(from: startDate)))
        }
        if let endDate {
            queryItems.append(URLQueryItem(name: "end_date", value: Self.dateFormatter.string(from: endDate)))
        }
        if let status {
            queryItems.append(URLQueryItem(name: "status", value: status.rawValue))
        }
        let request = authorizedGetRequest(path: "schedule", queryItems: queryItems)
        let response = try await apiClient.send(request, as: [ScheduleListItemResponseDTO].self)
        return response.compactMap(mapListItem)
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
        // calendar-summary aggregates shifts across ALL published schedules;
        // /schedule/my only sees the latest one (older weeks' shifts vanish).
        // Fall back to /schedule/my for older backend deployments.
        if let summary = try? await fetchMyCalendarSummary() {
            return summary.shifts.compactMap { shift in
                guard let date = Self.dateFormatter.date(from: shift.date) else { return nil }
                return AppScheduledShift(
                    id: shift.shiftId,
                    employeeId: summary.employee.id,
                    employeeName: summary.employee.fullName,
                    positionId: summary.employee.position?.id ?? 0,
                    positionName: summary.employee.position?.name ?? "",
                    date: date,
                    startMinutes: Self.minutes(from: shift.startTime),
                    endMinutes: Self.minutes(from: shift.endTime)
                )
            }
        }

        let request = apiClient.makeRequest(
            path: "schedule/my",
            method: "GET",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: [ScheduleShiftResponseDTO].self)
        return try response.map(mapShift)
    }

    private func fetchMyCalendarSummary() async throws -> EmployeeCalendarSummaryDTO {
        let request = apiClient.makeRequest(
            path: "employees/me/calendar-summary",
            method: "GET",
            requiresAuthorization: true
        )
        return try await apiClient.send(request, as: EmployeeCalendarSummaryDTO.self)
    }

    // MARK: - Assignment

    func fetchAvailableEmployees(
        scheduleId: Int,
        shift: AppScheduledShift,
        branchId: Int?,
        includeUnavailable: Bool
    ) async throws -> [AppAvailableEmployee] {
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "date", value: Self.dateFormatter.string(from: shift.date)),
            URLQueryItem(name: "start_time", value: Self.timeString(fromMinutes: shift.startMinutes)),
            URLQueryItem(name: "end_time", value: Self.timeString(fromMinutes: shift.endMinutes)),
            URLQueryItem(name: "position_id", value: String(shift.positionId)),
            URLQueryItem(name: "include_unavailable", value: includeUnavailable ? "true" : "false")
        ]
        if let branchId {
            queryItems.append(URLQueryItem(name: "branch_id", value: String(branchId)))
        }
        let request = authorizedGetRequest(
            path: "schedule/\(scheduleId)/employees/available",
            queryItems: queryItems
        )
        let response = try await apiClient.send(request, as: [AvailableEmployeeResponseDTO].self)
        return response.map(mapAvailableEmployee)
    }

    func assignRequirement(
        scheduleId: Int,
        requirementId: Int,
        employeeId: Int
    ) async throws -> AppSchedule {
        let body = try JSONEncoder().encode(RequirementAssignRequestDTO(employeeId: employeeId))
        let request = apiClient.makeRequest(
            path: "schedule/\(scheduleId)/requirements/\(requirementId)/assign",
            method: "POST",
            body: body,
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: ScheduleResponseDTO.self)
        return try mapSchedule(response)
    }

    // MARK: - Shift CRUD

    func createShift(scheduleId: Int, mutation: ScheduleShiftMutation) async throws -> AppSchedule {
        let payload = ManualShiftCreateRequestDTO(
            date: Self.dateFormatter.string(from: mutation.date),
            startTime: Self.timeString(fromMinutes: mutation.startMinutes),
            endTime: Self.timeString(fromMinutes: mutation.endMinutes),
            positionId: mutation.positionId,
            employeeId: mutation.employeeId.flatMap { $0 > 0 ? $0 : nil }
        )
        let body = try JSONEncoder().encode(payload)
        let request = apiClient.makeRequest(
            path: "schedule/\(scheduleId)/shifts",
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
        mutation: ScheduleShiftMutation
    ) async throws -> AppSchedule {
        let resolvedEmployeeId = mutation.employeeId.flatMap { $0 > 0 ? $0 : nil }
        // "reassign" replaces the shift's assignment with employee_id (a nil field
        // means "unassign"). Never send "remove" here: on the backend it deletes
        // the shift entirely, which used to make editing an unassigned shift
        // silently delete it.
        let payload = ScheduleShiftUpdateRequestDTO(
            date: Self.dateFormatter.string(from: mutation.date),
            startTime: Self.timeString(fromMinutes: mutation.startMinutes),
            endTime: Self.timeString(fromMinutes: mutation.endMinutes),
            positionId: mutation.positionId,
            employeeId: resolvedEmployeeId,
            action: "reassign"
        )
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

    func deleteSchedule(scheduleId: Int) async throws {
        let request = apiClient.makeRequest(
            path: "schedule/\(scheduleId)",
            method: "DELETE",
            requiresAuthorization: true
        )
        try await apiClient.sendWithoutResponseBody(request)
    }

    func deleteShift(scheduleId: Int, shiftId: Int) async throws -> AppSchedule {
        let request = apiClient.makeRequest(
            path: "schedule/\(scheduleId)/shifts/\(shiftId)",
            method: "DELETE",
            requiresAuthorization: true
        )
        try await apiClient.sendWithoutResponseBody(request)
        return try await fetchSchedule(scheduleId: scheduleId)
    }

    func updateScheduleRequirement(
        scheduleId: Int,
        requirementId: Int,
        mutation: ScheduleShiftMutation,
        quantity: Int
    ) async throws -> AppSchedule {
        let payload = ScheduleRequirementInScheduleUpdateDTO(
            branchId: nil,
            positionId: mutation.positionId,
            date: Self.dateFormatter.string(from: mutation.date),
            minStaff: quantity,
            requiredCount: quantity,
            startTime: Self.timeString(fromMinutes: mutation.startMinutes),
            endTime: Self.timeString(fromMinutes: mutation.endMinutes)
        )
        let body = try JSONEncoder().encode(payload)
        let request = apiClient.makeRequest(
            path: "schedule/\(scheduleId)/requirements/\(requirementId)",
            method: "PATCH",
            body: body,
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: ScheduleResponseDTO.self)
        return try mapSchedule(response)
    }

    // MARK: - Request helper

    private func authorizedGetRequest(path: String, queryItems: [URLQueryItem]) -> URLRequest {
        let baseURL = apiClient.baseURL.appendingPathComponent(path)
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        if !queryItems.isEmpty {
            components?.queryItems = queryItems
        }
        let url = components?.url ?? baseURL
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let accessToken = apiClient.accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    // MARK: - Mapping

    private func mapSchedule(_ dto: ScheduleResponseDTO) throws -> AppSchedule {
        guard let status = AppScheduleStatus(rawValue: dto.status) else {
            throw APIClientError.decodingFailed
        }
        return AppSchedule(
            id: dto.id,
            branchId: dto.branchId,
            startDate: dto.startDate.flatMap { Self.dateFormatter.date(from: $0) },
            endDate: dto.endDate.flatMap { Self.dateFormatter.date(from: $0) },
            status: status,
            shifts: try dto.shifts.map(mapShift),
            unfilledRequirements: try dto.unfilledRequirements.map(mapUnfilledRequirement)
        )
    }

    private func mapListItem(_ dto: ScheduleListItemResponseDTO) -> AppScheduleListItem? {
        guard
            let status = AppScheduleStatus(rawValue: dto.status),
            let start = Self.dateFormatter.date(from: dto.startDate),
            let end = Self.dateFormatter.date(from: dto.endDate)
        else {
            return nil
        }
        return AppScheduleListItem(
            id: dto.id,
            branchId: dto.branchId,
            startDate: start,
            endDate: end,
            status: status
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

    private func mapAvailableEmployee(_ dto: AvailableEmployeeResponseDTO) -> AppAvailableEmployee {
        AppAvailableEmployee(
            id: dto.id,
            fullName: dto.fullName,
            positionName: dto.position.name,
            branchId: dto.branch?.id,
            branchName: dto.branch?.name,
            availabilityStatus: AppEmployeeAvailabilityStatus.fromApiValue(dto.availabilityStatus),
            assignedHours: dto.assignedHours
        )
    }

    // MARK: - Formatting helpers

    private static func minutes(from timeString: String) -> Int {
        let parts = timeString.split(separator: ":").compactMap { Int($0) }
        guard parts.count >= 2 else { return 0 }
        return (parts[0] * 60) + parts[1]
    }

    static func timeString(fromMinutes minutes: Int) -> String {
        String(format: "%02d:%02d:00", minutes / 60, minutes % 60)
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
