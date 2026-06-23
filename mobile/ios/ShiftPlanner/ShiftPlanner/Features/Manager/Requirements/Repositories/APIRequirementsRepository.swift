import Foundation

final class APIRequirementsRepository: RequirementsRepository {
    private let apiClient: APIClient
    private let calendar = Calendar(identifier: .gregorian)

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func fetchPositions() async throws -> [RequirementPositionOption] {
        let request = apiClient.makeRequest(
            path: "positions/",
            method: "GET",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: [PositionResponseDTO].self)
        return response.map {
            RequirementPositionOption(id: $0.id, name: $0.title)
        }
    }

    func fetchRequirements(startDate: Date, endDate: Date) async throws -> [RequirementOccurrence] {
        let baseURL = apiClient.baseURL.appendingPathComponent("schedule/requirements")
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "start_date", value: dateString(from: startDate)),
            URLQueryItem(name: "end_date", value: dateString(from: endDate))
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

        let response = try await apiClient.send(request, as: [ScheduleRequirementResponseDTO].self)
        return try response.map(asOccurrence)
    }

    func createRequirementsBulk(
        startDate: Date,
        endDate: Date,
        weekdays: [Int],
        templates: [RequirementTemplateDraft]
    ) async throws -> [RequirementOccurrence] {
        let payload = ScheduleRequirementBulkCreateDTO(
            startDate: dateString(from: startDate),
            endDate: dateString(from: endDate),
            weekdays: weekdays,
            requirements: templates.map {
                ScheduleRequirementTemplateCreateDTO(
                    positionId: $0.positionId,
                    minStaff: $0.quantity,
                    startTime: timeString(for: $0.startSlot),
                    endTime: timeString(for: $0.endSlot)
                )
            }
        )

        let body = try JSONEncoder().encode(payload)
        let request = apiClient.makeRequest(
            path: "schedule/requirements/bulk",
            method: "POST",
            body: body,
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: ScheduleRequirementBulkResponseDTO.self)
        return try response.requirements.map(asOccurrence)
    }

    func deleteRequirement(id: Int) async throws {
        let request = apiClient.makeRequest(
            path: "schedule/requirements/\(id)",
            method: "DELETE",
            requiresAuthorization: true
        )
        try await apiClient.sendWithoutResponseBody(request)
    }

    private func asOccurrence(_ dto: ScheduleRequirementResponseDTO) throws -> RequirementOccurrence {
        guard let date = Self.dateFormatter.date(from: dto.date) else {
            throw APIClientError.decodingFailed
        }

        let weekday = (calendar.component(.weekday, from: date) + 5) % 7

        return RequirementOccurrence(
            id: dto.id,
            date: date,
            weekday: weekday,
            positionId: dto.positionId,
            positionName: dto.positionTitle,
            quantity: dto.minStaff,
            startSlot: slotIndex(from: dto.startTime),
            endSlot: slotIndex(from: dto.endTime)
        )
    }

    private func dateString(from date: Date) -> String {
        Self.dateFormatter.string(from: date)
    }

    private func timeString(for slot: Int) -> String {
        let totalMinutes = slot * 30
        let hour = totalMinutes / 60
        let minutes = totalMinutes % 60
        return String(format: "%02d:%02d:00", hour, minutes)
    }

    private func slotIndex(from timeString: String) -> Int {
        let parts = timeString.split(separator: ":").compactMap { Int($0) }
        guard parts.count >= 2 else { return 0 }
        return ((parts[0] * 60) + parts[1]) / 30
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
