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

            if viewModel.emailVerificationPending {
                VStack(spacing: 16) {
                    Image(systemName: "envelope.badge")
                        .font(.system(size: 44))
                        .foregroundStyle(themeManager.selectedTheme.accentColor)

                    Text(localized("Confirm your email", "Подтвердите почту"))
                        .font(.headline)
                        .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                    Text(localized(
                        "We sent a confirmation link to \(viewModel.email). Open it, then log in.",
                        "Мы отправили ссылку для подтверждения на \(viewModel.email). Откройте её и войдите."
                    ))
                        .font(.footnote)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                    if let errorMessage = viewModel.errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(themeManager.selectedTheme.destructiveColor)
                    }

                    Button {
                        Task { await viewModel.resendVerification() }
                    } label: {
                        if viewModel.isLoading {
                            ProgressView()
                                .tint(themeManager.selectedTheme.primaryActionTextColor)
                        } else {
                            Text(localized("Resend email", "Отправить письмо ещё раз"))
                        }
                    }
                    .buttonStyle(.plain)
                    .themePrimaryAction(isEnabled: !viewModel.isLoading)
                    .disabled(viewModel.isLoading)

                    Button(localized("Back to login", "Вернуться ко входу")) {
                        onShowLogin()
                    }
                    .buttonStyle(.plain)
                    .themeSecondaryAction()
                    .disabled(viewModel.isLoading)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .themeCard()
            } else {
                VStack(spacing: 12) {
                    ThemedSegmentedPicker(
                        selection: $viewModel.selectedRole,
                        segments: UserRole.allCases.map { ThemedSegment($0, $0.title) }
                    )

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
            }

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
