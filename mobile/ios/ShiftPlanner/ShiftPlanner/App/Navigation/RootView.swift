import SwiftUI

enum AuthScreen {
    case login
    case signUp
}
struct RootView: View {
    @StateObject private var authViewModel = AuthViewModel(repository: APIAuthRepository())
    
    @State private var authScreen: AuthScreen = .login
    
    var body: some View {
        Group {
            if let user = authViewModel.currentUser {
                switch user.role {
                case .manager: ManagerMainView()
                    
                case .employee: EmployeeMainView()
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
        .task {
            await authViewModel.loadCurrentUser()
        }
    }
}
