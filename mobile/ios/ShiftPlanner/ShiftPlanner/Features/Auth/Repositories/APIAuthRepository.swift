import Foundation

enum AuthRepositoryError: LocalizedError {
    case accountCreatedButLoginFailed

    var errorDescription: String? {
        switch self {
        case .accountCreatedButLoginFailed:
            return "Account was created, but automatic sign-in failed. Try logging in from the login screen."
        }
    }
}

final class APIAuthRepository: AuthRepository {
    private var currentUser: AppUser?
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func login(email: String, password: String) async throws -> AppUser {
        let requestBody = try JSONEncoder().encode(
            LoginRequest(email: email, password: password)
        )
        let request = apiClient.makeRequest(
            path: "auth/login",
            method: "POST",
            body: requestBody
        )

        let loginResponse = try await apiClient.send(request, as: LoginResponse.self)
        apiClient.accessToken = loginResponse.accessToken

        let user = try await fetchCurrentUser()
        currentUser = user
        return user
    }

    func signUp(
        email: String,
        password: String,
        name: String,
        role: UserRole
    ) async throws -> AppUser {
        let requestBody = try JSONEncoder().encode(
            RegisterRequest(
                fullName: name,
                email: email,
                password: password,
                role: role
            )
        )
        let request = apiClient.makeRequest(
            path: "auth/register",
            method: "POST",
            body: requestBody
        )

        _ = try await apiClient.send(request, as: RegisterResponse.self)

        do {
            return try await login(email: email, password: password)
        } catch {
            throw AuthRepositoryError.accountCreatedButLoginFailed
        }
    }

    func logout() async {
        if apiClient.accessToken != nil {
            let request = apiClient.makeRequest(
                path: "auth/logout",
                method: "POST",
                requiresAuthorization: true
            )
            try? await apiClient.sendWithoutResponseBody(request)
        }

        apiClient.clearAccessToken()
        currentUser = nil
    }

    func getCurrentUser() async -> AppUser? {
        if let currentUser {
            return currentUser
        }

        guard apiClient.accessToken != nil else {
            return nil
        }

        do {
            let user = try await fetchCurrentUser()
            currentUser = user
            return user
        } catch {
            apiClient.clearAccessToken()
            currentUser = nil
            return nil
        }
    }

    private func fetchCurrentUser() async throws -> AppUser {
        let request = apiClient.makeRequest(
            path: "auth/me",
            method: "GET",
            requiresAuthorization: true
        )
        let response = try await apiClient.send(request, as: CurrentUserResponse.self)

        return AppUser(
            id: String(response.id),
            email: response.email,
            name: response.fullName,
            role: response.role
        )
    }
}
