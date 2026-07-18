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
                Text(localized("Create account", "Создать аккаунт"))
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }

            VStack(spacing: 12) {
                Picker(localized("Role", "Роль"), selection: $viewModel.selectedRole) {
                    ForEach(UserRole.allCases) { role in
                        Text(role.title).tag(role)
                    }
                }
                .pickerStyle(.segmented)

                TextField(localized("Name", "Имя"), text: $viewModel.name)
                    .themeInputField()

                TextField(localized("Email", "Эл. почта"), text: $viewModel.email)
                    .autocapitalization(.none)
                    .autocorrectionDisabled(true)
                    .keyboardType(.emailAddress)
                    .themeInputField()

                SecureField(localized("Password", "Пароль"), text: $viewModel.password)
                    .themeInputField()

                SecureField(localized("Repeat password", "Повторите пароль"), text: $viewModel.confirmPassword)
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
                    Text(localized("Sign up", "Зарегистрироваться"))
                }
            }
            .buttonStyle(.plain)
            .themePrimaryAction(isEnabled: !viewModel.isLoading && viewModel.passwordsMatch)
            .disabled(viewModel.isLoading || !viewModel.passwordsMatch)

            Button(localized("Already have an account?", "Уже есть аккаунт?")) {
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
