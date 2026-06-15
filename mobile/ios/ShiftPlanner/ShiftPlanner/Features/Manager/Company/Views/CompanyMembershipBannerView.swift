import SwiftUI

struct CompanyMembershipBannerView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    let title: String
    let buttonTitle: String
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            Button(buttonTitle, action: action)
                .buttonStyle(.plain)
                .themePrimaryAction()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .themeCard()
        .padding(.horizontal)
        .padding(.top, 8)
    }
}
