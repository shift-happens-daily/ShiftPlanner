import SwiftUI

struct SignUpView: View {
    @ObservedObject var viewModel: AuthViewModel
    @EnvironmentObject private var themeManager: ThemeManager
    let onShowLogin: () -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            
            VStack(spacing: 8) {
                Text("ShiftPlanner")
                    .font(.largeTitle)
                    .bold()
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                Text("Create account")
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }
            
            VStack(spacing: 12) {
                Picker("Role", selection: $viewModel.selectedRole) {
                    ForEach(UserRole.allCases) { role in
                        Text(role.title).tag(role)
                    }
                }
                .pickerStyle(.segmented)

                TextField("Name", text: $viewModel.name)
                    .themeInputField()
                
                TextField("Email", text: $viewModel.email)
                    .autocapitalization(.none)
                    .autocorrectionDisabled(true)
                    .keyboardType(.emailAddress)
                    .themeInputField()
                
                SecureField("Password", text: $viewModel.password)
                    .themeInputField()
                
                SecureField("Repeat password", text: $viewModel.confirmPassword)
                    .themeInputField()
            }
            
            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.destructiveColor)
            }
            
            Button {
                Task {
                    await viewModel.signUp()
                }
            } label: {
                if viewModel.isLoading {
                    ProgressView()
                        .tint(themeManager.selectedTheme.primaryActionTextColor)
                } else {
                    Text("Sign up")
                }
            }
            .buttonStyle(.plain)
            .themePrimaryAction(isEnabled: !viewModel.isLoading && viewModel.passwordsMatch)
            .disabled(viewModel.isLoading || !viewModel.passwordsMatch)
            
            Button("Already have an account?") {
                onShowLogin()
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


#Preview {
    SignUpView(
        viewModel: AuthViewModel(
            repository: MockAuthRepository()
        ),
        onShowLogin: {}
    )
    .environmentObject(ThemeManager())
}
