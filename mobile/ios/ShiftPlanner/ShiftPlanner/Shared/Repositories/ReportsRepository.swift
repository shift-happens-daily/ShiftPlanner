import Foundation

protocol ReportsRepository {
    func fetchEmployeeReports(startDate: Date?, endDate: Date?) async throws -> [EmployeeReport]
    func fetchMyReport(startDate: Date?, endDate: Date?) async throws -> MySelfReport
}

final class APIReportsRepository: ReportsRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func fetchEmployeeReports(startDate: Date?, endDate: Date?) async throws -> [EmployeeReport] {
        let request = authorizedGetRequest(path: "reports/employees", startDate: startDate, endDate: endDate)
        let response = try await apiClient.send(request, as: [EmployeeReportResponseDTO].self)
        return response.map {
            EmployeeReport(
                employeeId: $0.employeeId,
                fullName: $0.fullName,
                position: $0.position,
                totalHours: $0.totalHours,
                totalShifts: $0.totalShifts
            )
        }
    }

    func fetchMyReport(startDate: Date?, endDate: Date?) async throws -> MySelfReport {
        let request = authorizedGetRequest(path: "reports/me", startDate: startDate, endDate: endDate)
        let response = try await apiClient.send(request, as: MySelfReportResponseDTO.self)
        return MySelfReport(
            employeeId: response.employeeId,
            fullName: response.fullName,
            totalHours: response.totalHours,
            totalShifts: response.totalShifts
        )
    }

    private func authorizedGetRequest(path: String, startDate: Date?, endDate: Date?) -> URLRequest {
        let baseURL = apiClient.baseURL.appendingPathComponent(path)
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        var queryItems: [URLQueryItem] = []
        if let startDate {
            queryItems.append(URLQueryItem(name: "start_date", value: Self.dateFormatter.string(from: startDate)))
        }
        if let endDate {
            queryItems.append(URLQueryItem(name: "end_date", value: Self.dateFormatter.string(from: endDate)))
        }
        if !queryItems.isEmpty {
            components?.queryItems = queryItems
        }
        var request = URLRequest(url: components?.url ?? baseURL)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let accessToken = apiClient.accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
