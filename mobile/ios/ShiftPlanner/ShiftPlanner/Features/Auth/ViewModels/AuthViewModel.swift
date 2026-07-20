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
    /// Set after sign-up when the backend requires the user to confirm their
    /// email before they can log in.
    @Published var emailVerificationPending = false

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
        emailVerificationPending = false

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
        emailVerificationPending = false

        do {
            let outcome = try await repository.signUp(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password,
                name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                role: selectedRole)

            switch outcome {
            case .loggedIn(let user):
                currentUser = user
            case .verificationRequired:
                emailVerificationPending = true
            }

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    /// Re-sends the email confirmation link to the address being registered.
    func resendVerification() async {
        isLoading = true
        errorMessage = nil

        do {
            try await repository.resendVerification(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines)
            )
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func logout() async {
        await repository.logout()
        resetSession()
    }

    /// Deletes the account on the backend, then drops the local session.
    /// Returns false (keeping the session) when the request fails.
    @discardableResult
    func deleteAccount() async -> Bool {
        do {
            try await repository.deleteAccount()
            resetSession()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func loadCurrentUser() async {
        currentUser = await repository.getCurrentUser()
    }

    func updateCurrentUser(_ user: AppUser) {
        currentUser = user
    }

    private func resetSession() {
        currentUser = nil
        email = ""
        password = ""
        confirmPassword = ""
        name = ""
        selectedRole = .employee
        errorMessage = nil
        emailVerificationPending = false
    }
}
