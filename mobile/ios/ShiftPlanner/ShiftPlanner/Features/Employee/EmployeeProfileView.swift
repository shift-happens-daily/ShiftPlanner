import SwiftUI

struct EmployeeProfileView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    let user: AppUser
    let onLogout: () async -> Void

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 24) {
                    VStack(spacing: 12) {
                        Image(systemName: "person.crop.circle.fill")
                            .font(.system(size: 72))
                            .foregroundStyle(themeManager.selectedTheme.accentColor)

                        Text(user.name)
                            .font(.title2)
                            .bold()
                            .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                        Text(user.email)
                            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                        Text(user.role.title)
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
                        Text("App Theme")
                            .font(.title3)
                            .fontWeight(.bold)
                            .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                        Text("Choose how ShiftPlanner should look across the whole app.")
                            .font(.subheadline)
                            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                        Text("Current: \(themeManager.selectedTheme.title)")
                            .font(.footnote)
                            .fontWeight(.semibold)
                            .foregroundStyle(themeManager.selectedTheme.accentColor)

                        Picker("Theme", selection: $themeManager.selectedTheme) {
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
                        Text("Log out")
                    }
                    .buttonStyle(.plain)
                    .themePrimaryAction()

                    Spacer(minLength: 0)
                }
                .padding()
            }
            .background(themeManager.selectedTheme.screenBackground.ignoresSafeArea())
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
