import Foundation

/// Result of a sign-up: either an immediate session, or a pending email
/// confirmation the user must complete before they can log in.
enum SignUpOutcome {
    case loggedIn(AppUser)
    case verificationRequired(email: String, message: String?)
}

protocol AuthRepository {
    func login(email: String, password: String) async throws -> AppUser

    func signUp(email: String, password: String, name: String, role: UserRole) async throws -> SignUpOutcome
    func resendVerification(email: String) async throws

    func logout() async
    func getCurrentUser() async -> AppUser?

    /// Permanently deletes the current account (DELETE auth/me).
    func deleteAccount() async throws
}
