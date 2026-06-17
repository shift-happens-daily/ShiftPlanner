import SwiftUI

struct ManagerCompanyAccessContentView: View {
    @EnvironmentObject private var themeManager: ThemeManager

    let user: AppUser
    let onUserUpdated: (AppUser) -> Void

    @State private var isShowingInviteSheet = false

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 16) {
                Text("You are not attached to a company yet.")
                    .font(.title3)
                    .bold()
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                Text("You can enter an invite code if your company already exists, or create a new company.")
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }

            VStack(alignment: .leading, spacing: 12) {
                Text("Join by invite code")
                    .font(.headline)
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                Text("Useful when your company already exists or when multiple managers will be supported.")
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                Button("Enter invite code") {
                    isShowingInviteSheet = true
                }
                .buttonStyle(.plain)
                .themeSecondaryAction()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .themeCard()

            VStack(alignment: .leading, spacing: 12) {
                Text("Create a company")
                    .font(.headline)
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                Text("Set up the company name now and prepare branch data for the upcoming backend expansion.")
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                NavigationLink("Open company setup") {
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
