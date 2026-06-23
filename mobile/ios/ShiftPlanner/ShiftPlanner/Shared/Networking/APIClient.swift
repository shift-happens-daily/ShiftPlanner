import Foundation

final class APIClient {
    static let shared = APIClient()
    private static let iso8601FormatterWithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
    private static let iso8601Formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
    private static let backendDateFormatterWithFractionalSeconds: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSSSS"
        return formatter
    }()
    private static let backendDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return formatter
    }()

    private init() {}

    let baseURL = APIClient.makeBaseURL()

    private let session = URLSession.shared
    private let accessTokenKey = "shiftplanner.accessToken"
    private static let apiBaseURLKey = "shiftplanner.apiBaseURL"

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
        let (data, response): (Data, URLResponse)

        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw mapTransportError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw parseError(from: data, statusCode: httpResponse.statusCode)
        }

        do {
            return try Self.makeJSONDecoder().decode(type, from: data)
        } catch {
            throw APIClientError.decodingFailed
        }
    }

    func sendWithoutResponseBody(_ request: URLRequest) async throws {
        let response: URLResponse

        do {
            (_, response) = try await session.data(for: request)
        } catch {
            throw mapTransportError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIClientError.requestFailed(
                message: LanguageManager.localizedFormat(
                    "Request failed with status code %d.",
                    "Запрос завершился с кодом %d.",
                    httpResponse.statusCode
                )
            )
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

        return .requestFailed(
            message: LanguageManager.localizedFormat(
                "Request failed with status code %d.",
                "Запрос завершился с кодом %d.",
                statusCode
            )
        )
    }

    private func mapTransportError(_ error: Error) -> APIClientError {
        guard let urlError = error as? URLError else {
            return .requestFailed(message: error.localizedDescription)
        }

        switch urlError.code {
        case .timedOut, .cannotConnectToHost, .cannotFindHost, .networkConnectionLost, .notConnectedToInternet:
            return .requestFailed(
                message: LanguageManager.localized(
                    "Cannot reach the server at \(baseURL.absoluteString). Start the backend and, for iPhone Simulator, use http://127.0.0.1:8000.",
                    "Не удается подключиться к серверу \(baseURL.absoluteString). Запустите бэкенд и, если это симулятор iPhone, используйте http://127.0.0.1:8000."
                )
            )
        default:
            return .requestFailed(message: urlError.localizedDescription)
        }
    }

    private static func makeBaseURL() -> URL {
        let candidate =
            ProcessInfo.processInfo.environment["API_BASE_URL"] ??
            UserDefaults.standard.string(forKey: apiBaseURLKey) ??
            defaultBaseURLString

        guard let url = URL(string: candidate) else {
            fatalError("Invalid API base URL: \(candidate)")
        }

        return url
    }

    private static var defaultBaseURLString: String {
        #if targetEnvironment(simulator)
        return "http://127.0.0.1:8000"
        #else
        return "http://10.91.61.1:8000"
        #endif
    }

    private static func makeJSONDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)

            if let date =
                iso8601FormatterWithFractionalSeconds.date(from: value) ??
                iso8601Formatter.date(from: value) ??
                backendDateFormatterWithFractionalSeconds.date(from: value) ??
                backendDateFormatter.date(from: value) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Invalid ISO8601 date: \(value)"
            )
        }
        return decoder
    }

    private func humanReadableValidationMessage(from error: APIValidationErrorItem) -> String {
        guard let field = error.loc?.last else {
            return error.msg
        }

        switch field {
        case "password" where error.msg.contains("at least 8 characters"):
            return localized("Password must be at least 8 characters.", "Пароль должен содержать минимум 8 символов.")
        case "email":
            return localized("Please enter a valid email.", "Введите корректную почту.")
        case "full_name":
            return localized("Name is required.", "Имя обязательно.")
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
            return localized("Server returned an invalid response.", "Сервер вернул некорректный ответ.")
        case .decodingFailed:
            return localized("Failed to decode server response.", "Не удалось декодировать ответ сервера.")
        case let .requestFailed(message):
            return message
        }
    }
}
