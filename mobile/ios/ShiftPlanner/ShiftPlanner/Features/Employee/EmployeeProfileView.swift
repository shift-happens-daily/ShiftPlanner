import SwiftUI

struct EmployeeProfileView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel: EmployeeProfileViewModel
    let onLogout: () async -> Void

    init(user: AppUser, onLogout: @escaping () async -> Void) {
        _viewModel = StateObject(wrappedValue: EmployeeProfileViewModel(user: user))
        self.onLogout = onLogout
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
}
