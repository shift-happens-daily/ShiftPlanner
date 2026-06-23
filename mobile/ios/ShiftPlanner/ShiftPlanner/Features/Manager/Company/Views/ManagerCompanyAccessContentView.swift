import SwiftUI

struct ManagerCompanyAccessContentView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager

    let user: AppUser
    let onUserUpdated: (AppUser) -> Void

    @State private var isShowingInviteSheet = false

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 16) {
                Text(languageManager.text("You are not attached to a company yet.", "Вы пока не привязаны к компании."))
                    .font(.title3)
                    .bold()
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                Text(languageManager.text("You can enter an invite code if your company already exists, or create a new company.", "Можно ввести инвайт-код, если компания уже существует, или создать новую компанию."))
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }

            VStack(alignment: .leading, spacing: 12) {
                Text(languageManager.text("Join by invite code", "Присоединиться по коду"))
                    .font(.headline)
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                Text(languageManager.text("Useful when your company already exists or when multiple managers will be supported.", "Полезно, если компания уже создана или позже появится поддержка нескольких менеджеров."))
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                Button(languageManager.text("Enter invite code", "Ввести код")) {
                    isShowingInviteSheet = true
                }
                .buttonStyle(.plain)
                .themeSecondaryAction()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .themeCard()

            VStack(alignment: .leading, spacing: 12) {
                Text(languageManager.text("Create a company", "Создать компанию"))
                    .font(.headline)
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                Text(languageManager.text("Set up the company name now and prepare branch data for the upcoming backend expansion.", "Сейчас можно настроить название компании и заранее заполнить данные для будущего расширения бэкенда."))
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                NavigationLink(languageManager.text("Open company setup", "Открыть настройку компании")) {
                    CompanySetupView { createdCompany in
                        onUserUpdated(user.withCompany(createdCompany))
                    }
                }
                .buttonStyle(.plain)
                .themePrimaryAction()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .themeCard()
        }
        .sheet(isPresented: $isShowingInviteSheet) {
            CompanyInviteView(
                mode: .managerInvite,
                onUserJoined: onUserUpdated
            )
        }
    }
}
