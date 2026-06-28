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
            return localized("Email is required.", "Почта обязательна.")
        case .emptyPassword:
            return localized("Password is required.", "Пароль обязателен.")
        case .emptyName:
            return localized("Name is required.", "Имя обязательно.")
        case .invalidEmail:
            return localized("Enter a valid email.", "Введите корректную почту.")
        case .passwordTooShort:
            return localized("Password must be at least 8 characters.", "Пароль должен содержать минимум 8 символов.")
            
        case .passwordsDontMatch:
            return localized("Passwords do not match.", "Пароли не совпадают.")
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
            role: .manager,
            employeeId: nil,
            company: nil,
            branch: nil,
            position: nil
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
            role: role,
            employeeId: nil,
            company: nil,
            branch: nil,
            position: nil
        )

        currentUser = user
        return user
    }

    func logout() async {
        currentUser = nil
    }

    func deleteCurrentAccount() async throws {
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

        if password.count < 8 {
            throw AuthError.passwordTooShort
        }
        
    }
}
