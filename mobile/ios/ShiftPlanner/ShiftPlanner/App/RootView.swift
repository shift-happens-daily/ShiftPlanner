import SwiftUI

enum AuthScreen {
    case login
    case signUp
}
struct RootView: View {
    @StateObject private var authViewModel = AuthViewModel(repository: MockAuthRepository())
    
    @State private var authScreen: AuthScreen = .login
    
    var body: some View {
        if let user = authViewModel.currentUser {
            MainView(
                user: user,
                onLogout: {
                    Task {
                        await authViewModel.logout()
                    }
                }
            )
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
}
