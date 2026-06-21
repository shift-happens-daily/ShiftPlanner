import SwiftUI

struct LoginView: View {
    @ObservedObject var viewModel: AuthViewModel
    @EnvironmentObject private var themeManager: ThemeManager
    let onShowSignUp: () -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            
            VStack(spacing: 8) {
                Text("ShiftPlanner")
                    .font(.largeTitle)
                    .bold()
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                Text("Sign in to your account")
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }
            
            VStack(spacing: 12) {
                TextField("Email", text: $viewModel.email)
                    .autocapitalization(.none)
                    .autocorrectionDisabled(true)
                    .keyboardType(.emailAddress)
                    .themeInputField()
                
                SecureField("Password", text: $viewModel.password)
                    .themeInputField()
            }
            
            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.destructiveColor)
            }
            
            Button {
                Task {
                    await viewModel.login()
                }
            } label: {
                if viewModel.isLoading {
                    ProgressView()
                        .tint(themeManager.selectedTheme.primaryActionTextColor)
                } else {
                    Text("Login")
                }
            }
            .buttonStyle(.plain)
            .themePrimaryAction(isEnabled: !viewModel.isLoading)
            .disabled(viewModel.isLoading)
            
            Button("Create account") {
                onShowSignUp()
            }
            .buttonStyle(.plain)
            .themeSecondaryAction()
            .disabled(viewModel.isLoading)
            
            Spacer()
        }
        .padding()
        .background(themeManager.selectedTheme.screenBackground.ignoresSafeArea())
    }
}
