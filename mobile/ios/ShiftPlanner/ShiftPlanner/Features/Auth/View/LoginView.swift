import SwiftUI

struct LoginView: View {
    @ObservedObject var viewModel: AuthViewModel
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    let onShowSignUp: () -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            
            VStack(spacing: 8) {
                Text("ShiftPlanner")
                    .font(.largeTitle)
                    .bold()
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                Text(languageManager.text("Sign in to your account", "Войдите в аккаунт"))
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }

            Picker(languageManager.text("Language", "Язык"), selection: $languageManager.selectedLanguage) {
                ForEach(AppLanguage.allCases) { language in
                    Text(language.title).tag(language)
                }
            }
            .pickerStyle(.segmented)
            
            VStack(spacing: 12) {
                TextField(languageManager.text("Email", "Почта"), text: $viewModel.email)
                    .autocapitalization(.none)
                    .autocorrectionDisabled(true)
                    .keyboardType(.emailAddress)
                    .themeInputField()
                
                SecureField(languageManager.text("Password", "Пароль"), text: $viewModel.password)
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
                    Text(languageManager.text("Login", "Войти"))
                }
            }
            .buttonStyle(.plain)
            .themePrimaryAction(isEnabled: !viewModel.isLoading)
            .disabled(viewModel.isLoading)
            
            Button(languageManager.text("Create account", "Создать аккаунт")) {
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
