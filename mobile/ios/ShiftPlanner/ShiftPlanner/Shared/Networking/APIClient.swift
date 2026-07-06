import Foundation

final class APIClient {
    static let shared = APIClient()

    private init() {}

    let baseURL = URL(string: "https://shiftplanner.online/api")!

    private let session = URLSession.shared
    private let accessTokenKey = "shiftplanner.accessToken"

    var accessToken: String? {
        get { UserDefaults.standard.string(forKey: accessTokenKey) }
        set { UserDefaults.standard.set(newValue, forKey: accessTokenKey) }
    }

    func clearAccessToken() {
        UserDefaults.standard.removeObject(forKey: accessTokenKey)
    }

    func makeRequest(
        path: String,
        method: String,
        body: Data? = nil,
        requiresAuthorization: Bool = false
    ) -> URLRequest {
        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if requiresAuthorization, let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        request.httpBody = body
        return request
    }

    func send<T: Decodable>(_ request: URLRequest, as type: T.Type) async throws -> T {
        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw parseError(from: data, statusCode: httpResponse.statusCode)
        }

        do {
            return try JSONDecoder().decode(type, from: data)
        } catch {
            throw APIClientError.decodingFailed
        }
    }

    func sendWithoutResponseBody(_ request: URLRequest) async throws {
        let (_, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIClientError.requestFailed(message: "Request failed with status code \(httpResponse.statusCode).")
        }
    }

    private func parseError(from data: Data, statusCode: Int) -> APIClientError {
        if let validationError = try? JSONDecoder().decode(APIValidationErrorResponse.self, from: data),
           let firstError = validationError.detail.first {
            return .requestFailed(message: humanReadableValidationMessage(from: firstError))
        }

        if let errorResponse = try? JSONDecoder().decode(APIErrorResponse.self, from: data),
           let detail = errorResponse.detail,
           !detail.isEmpty {
            return .requestFailed(message: detail)
        }

        if let rawMessage = String(data: data, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
           !rawMessage.isEmpty {
            return .requestFailed(message: rawMessage)
        }

        return .requestFailed(message: "Request failed with status code \(statusCode).")
    }

    private func humanReadableValidationMessage(from error: APIValidationErrorItem) -> String {
        guard let field = error.loc?.last else {
            return error.msg
        }

        switch field {
        case "password" where error.msg.contains("at least 8 characters"):
            return "Password must be at least 8 characters."
        case "email":
            return "Please enter a valid email."
        case "full_name":
            return "Name is required."
        default:
            return error.msg.prefix(1).uppercased() + error.msg.dropFirst() + "."
        }
    }
}

enum APIClientError: LocalizedError {
    case invalidResponse
    case decodingFailed
    case requestFailed(message: String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Server returned an invalid response."
        case .decodingFailed:
            return "Failed to decode server response."
        case let .requestFailed(message):
            return message
        }
    }
}
