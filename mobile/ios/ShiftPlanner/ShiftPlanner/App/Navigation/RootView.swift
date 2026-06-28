import SwiftUI

enum AuthScreen {
    case login
    case signUp
}
struct RootView: View {
    @StateObject private var authViewModel = AuthViewModel(repository: APIAuthRepository())
    @EnvironmentObject private var themeManager: ThemeManager
    
    @State private var authScreen: AuthScreen = .login
    @State private var didLoadSession = false
    
    var body: some View {
        Group {
            if let user = authViewModel.currentUser {
                switch user.role {
                case .manager:
                    ManagerMainView(
                        user: user,
                        onLogout: {
                            await authViewModel.logout()
                        },
                        onUserUpdated: { updatedUser in
                            authViewModel.updateCurrentUser(updatedUser)
                        }
                    )
                    
                case .employee:
                    EmployeeMainView(
                        user: user,
                        onLogout: {
                            await authViewModel.logout()
                        },
                        onDeleteAccount: {
                            try await authViewModel.deleteCurrentAccount()
                        },
                        onUserUpdated: { updatedUser in
                            authViewModel.updateCurrentUser(updatedUser)
                        }
                    )
                }
            } else {
                switch authScreen {
                case .login:
                    LoginView(viewModel: authViewModel, onShowSignUp: {
                        authScreen = .signUp
                    })
                case .signUp:
                    SignUpView(viewModel: authViewModel, onShowLogin: {
                        authScreen = .login
                    })
                }
            }
        }
        .background(themeManager.selectedTheme.screenBackground.ignoresSafeArea())
        .task {
            guard !didLoadSession else { return }
            didLoadSession = true
            await authViewModel.loadCurrentUser()
        }
    }
}
