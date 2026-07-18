import Foundation

protocol AuthRepository {
    func login(email: String, password: String) async throws -> AppUser

    func signUp(email: String, password: String, name: String, role: UserRole) async throws -> AppUser

    func logout() async
    func getCurrentUser() async -> AppUser?

    /// Permanently deletes the current account (DELETE auth/me).
    func deleteAccount() async throws
}
