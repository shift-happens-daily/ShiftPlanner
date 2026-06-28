import SwiftUI

struct EmployeeProfileView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel: EmployeeProfileViewModel
    let onLogout: () async -> Void
    let onDeleteAccount: () async throws -> Void

    @State private var isDeletingAccount = false
    @State private var isShowingDeleteConfirmation = false
    @State private var deletionErrorMessage: String?

    init(
        user: AppUser,
        onLogout: @escaping () async -> Void,
        onDeleteAccount: @escaping () async throws -> Void
    ) {
        _viewModel = StateObject(wrappedValue: EmployeeProfileViewModel(user: user))
        self.onLogout = onLogout
        self.onDeleteAccount = onDeleteAccount
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 24) {
                    VStack(spacing: 12) {
                        Image(systemName: "person.crop.circle.fill")
                            .font(.system(size: 72))
                            .foregroundStyle(themeManager.selectedTheme.accentColor)

                        Text(viewModel.user.name)
                            .font(.title2)
                            .bold()
                            .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                        Text(viewModel.user.email)
                            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                        Text(viewModel.user.role.title)
                            .font(.subheadline)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(themeManager.selectedTheme.cardTint)
                            .clipShape(Capsule())
                    }
                    .frame(maxWidth: .infinity)
                    .padding(24)
                    .themeCard()

                    VStack(alignment: .leading, spacing: 16) {
                        Text(languageManager.text("Work Profile", "Рабочий профиль"))
                            .font(.title3)
                            .fontWeight(.bold)
                            .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                        profileInfoRow(
                            title: languageManager.text("Company", "Компания"),
                            value: viewModel.companyName ?? languageManager.text("Not joined yet", "Пока не присоединились")
                        )

                        if let companyAddress = viewModel.companyAddress {
                            profileInfoRow(
                                title: languageManager.text("Company address", "Адрес компании"),
                                value: companyAddress
                            )
                        }

                        profileInfoRow(
                            title: languageManager.text("Branch", "Филиал"),
                            value: viewModel.branchName ?? languageManager.text("Not assigned yet", "Пока не назначен")
                        )

                        if let branchAddress = viewModel.branchAddress {
                            profileInfoRow(
                                title: languageManager.text("Branch address", "Адрес филиала"),
                                value: branchAddress
                            )
                        }

                        profileInfoRow(
                            title: languageManager.text("Position", "Должность"),
                            value: viewModel.positionName ?? languageManager.text("Not assigned yet", "Пока не назначена")
                        )
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
                    .themeCard()

                    VStack(alignment: .leading, spacing: 16) {
                        Text(languageManager.text("Language", "Язык"))
                            .font(.title3)
                            .fontWeight(.bold)
                            .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                        Text(languageManager.text("Choose the app language.", "Выберите язык приложения."))
                            .font(.subheadline)
                            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                        Picker(languageManager.text("Language", "Язык"), selection: $languageManager.selectedLanguage) {
                            ForEach(AppLanguage.allCases) { language in
                                Text(language.title).tag(language)
                            }
                        }
                        .pickerStyle(.segmented)
                        .padding(8)
                        .background(themeManager.selectedTheme.surfaceColor)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(themeManager.selectedTheme.accentColor.opacity(0.24), lineWidth: 1.2)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
                    .themeCard()

                    VStack(alignment: .leading, spacing: 16) {
                        Text(languageManager.text("App Theme", "Тема приложения"))
                            .font(.title3)
                            .fontWeight(.bold)
                            .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                        Text(languageManager.text("Choose how ShiftPlanner should look across the whole app.", "Выберите, как ShiftPlanner будет выглядеть во всем приложении."))
                            .font(.subheadline)
                            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                        Text("\(languageManager.text("Current", "Сейчас")): \(themeManager.selectedTheme.title)")
                            .font(.footnote)
                            .fontWeight(.semibold)
                            .foregroundStyle(themeManager.selectedTheme.accentColor)

                        Picker(languageManager.text("Theme", "Тема"), selection: $themeManager.selectedTheme) {
                            ForEach(AppTheme.allCases) { theme in
                                Text(theme.title).tag(theme)
                            }
                        }
                        .pickerStyle(.segmented)
                        .padding(8)
                        .background(themeManager.selectedTheme.surfaceColor)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(themeManager.selectedTheme.accentColor.opacity(0.24), lineWidth: 1.2)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
                    .themeCard()

                    VStack(alignment: .leading, spacing: 14) {
                        Text(languageManager.text("Account", "Аккаунт"))
                            .font(.title3)
                            .fontWeight(.bold)
                            .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                        Text(
                            languageManager.text(
                                "You can permanently delete your employee account from here.",
                                "Здесь можно навсегда удалить свой аккаунт сотрудника."
                            )
                        )
                        .font(.subheadline)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                        Button {
                            isShowingDeleteConfirmation = true
                        } label: {
                            if isDeletingAccount {
                                ProgressView()
                                    .tint(themeManager.selectedTheme.primaryActionTextColor)
                            } else {
                                Text(languageManager.text("Delete account", "Удалить аккаунт"))
                            }
                        }
                        .buttonStyle(.plain)
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 14)
                        .foregroundStyle(themeManager.selectedTheme.primaryActionTextColor)
                        .background(
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .fill(
                                    isDeletingAccount
                                    ? themeManager.selectedTheme.secondaryTextColor.opacity(0.45)
                                    : themeManager.selectedTheme.destructiveColor
                                )
                        )
                        .disabled(isDeletingAccount)

                        if let deletionErrorMessage {
                            Text(deletionErrorMessage)
                                .font(.footnote)
                                .foregroundStyle(themeManager.selectedTheme.destructiveColor)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
                    .themeCard()

                    Button {
                        Task {
                            await onLogout()
                        }
                    } label: {
                        Text(languageManager.text("Log out", "Выйти"))
                    }
                    .buttonStyle(.plain)
                    .themePrimaryAction()

                    Spacer(minLength: 0)
                }
                .padding()
            }
            .background(themeManager.selectedTheme.screenBackground.ignoresSafeArea())
            .navigationTitle(languageManager.text("Profile", "Профиль"))
            .navigationBarTitleDisplayMode(.inline)
            .confirmationDialog(
                languageManager.text("Delete account?", "Удалить аккаунт?"),
                isPresented: $isShowingDeleteConfirmation,
                titleVisibility: .visible
            ) {
                Button(languageManager.text("Delete", "Удалить"), role: .destructive) {
                    Task {
                        await deleteAccount()
                    }
                }
                Button(languageManager.text("Cancel", "Отмена"), role: .cancel) {}
            } message: {
                Text(
                    languageManager.text(
                        "This action cannot be undone.",
                        "Это действие нельзя отменить."
                    )
                )
            }
        }
    }

    @ViewBuilder
    private func profileInfoRow(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

            Text(value)
                .font(.body)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
        }
    }

    private func deleteAccount() async {
        isDeletingAccount = true
        deletionErrorMessage = nil

        do {
            try await onDeleteAccount()
        } catch {
            deletionErrorMessage = error.localizedDescription
            isDeletingAccount = false
        }
    }
}
