import Foundation

enum AuthError: LocalizedError {
    case emptyEmail
    case emptyPassword
    case emptyName
    case invalidEmail
    case passwordTooShort
    case passwordsDontMatch

    var errorDescription: String? {
        switch self {
        case .emptyEmail:
            return "Email is required"
        case .emptyPassword:
            return "Password is required"
        case .emptyName:
            return "Name is required"
        case .invalidEmail:
            return "Enter a valid email"
        case .passwordTooShort:
            return "Password must be at least 6 characters"
            
        case .passwordsDontMatch:
            return "Passwords do not match"
        }
    }
}

final class MockAuthRepository: AuthRepository {
    private var currentUser: AppUser?

    func login(email: String, password: String) async throws -> AppUser {
        try await Task.sleep(nanoseconds: 700_000_000)

        try validateLogin(email: email, password: password)

        let user = AppUser(
            id: UUID().uuidString,
            email: email,
            name: "Test User",
            role: .manager
        )

        currentUser = user
        return user
    }

    func signUp(
        email: String,
        password: String,
        name: String,
        role: UserRole
    ) async throws -> AppUser {
        try await Task.sleep(nanoseconds: 700_000_000)

        try validateSignUp(
            email: email,
            password: password,
            name: name
        )

        let user = AppUser(
            id: UUID().uuidString,
            email: email,
            name: name,
            role: role
        )

        currentUser = user
        return user
    }

    func logout() async {
        currentUser = nil
    }

    func getCurrentUser() async -> AppUser? {
        currentUser
    }

    private func validateLogin(email: String, password: String) throws {
        if email.isEmpty {
            throw AuthError.emptyEmail
        }

        if !email.contains("@") {
            throw AuthError.invalidEmail
        }

        if password.isEmpty {
            throw AuthError.emptyPassword
        }
    }

    private func validateSignUp(
        email: String,
        password: String,
        name: String
    ) throws {
        if name.isEmpty {
            throw AuthError.emptyName
        }

        if email.isEmpty {
            throw AuthError.emptyEmail
        }

        if !email.contains("@") {
            throw AuthError.invalidEmail
        }

        if password.isEmpty {
            throw AuthError.emptyPassword
        }

        if password.count < 6 {
            throw AuthError.passwordTooShort
        }
        
    }
}
