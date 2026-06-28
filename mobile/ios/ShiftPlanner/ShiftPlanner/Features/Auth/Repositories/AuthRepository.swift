import Foundation

protocol AuthRepository {
    func login(email: String, password: String) async throws -> AppUser
    
    func signUp(email: String, password: String, name: String, role: UserRole) async throws -> AppUser
    
    func logout() async
    func deleteCurrentAccount() async throws
    func getCurrentUser() async -> AppUser?
}
