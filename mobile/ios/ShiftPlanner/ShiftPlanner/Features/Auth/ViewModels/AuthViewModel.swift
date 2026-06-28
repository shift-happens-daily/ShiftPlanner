import Foundation
import SwiftUI
import Combine

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var confirmPassword = ""
    @Published var name = ""
    @Published var selectedRole: UserRole = .employee
    
    @Published var currentUser: AppUser?
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    var passwordsMatch: Bool {
        !name.isEmpty &&
            !email.isEmpty &&
            !password.isEmpty &&
            !confirmPassword.isEmpty &&
            password == confirmPassword
    }
    
    private let repository: AuthRepository
    
    init(repository: AuthRepository) {
        self.repository = repository
    }
    
    func login() async {
        isLoading = true
        errorMessage = nil
        
        do {
            let user = try await repository.login(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password)
            currentUser = user
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func signUp() async {
        
        if !passwordsMatch {
            errorMessage = localized("Passwords do not match.", "Пароли не совпадают.")
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        
        do {
            let user = try await repository.signUp(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password,
                name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                role: selectedRole)
        
            currentUser = user
            
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func logout() async {
        await repository.logout()
        currentUser = nil
        email = ""
        password = ""
        confirmPassword = ""
        name = ""
        selectedRole = .employee
        errorMessage = nil
        
    }

    func deleteCurrentAccount() async throws {
        try await repository.deleteCurrentAccount()
        currentUser = nil
        email = ""
        password = ""
        confirmPassword = ""
        name = ""
        selectedRole = .employee
        errorMessage = nil
    }

    func loadCurrentUser() async {
        currentUser = await repository.getCurrentUser()
    }

    func updateCurrentUser(_ user: AppUser) {
        currentUser = user
    }
}
