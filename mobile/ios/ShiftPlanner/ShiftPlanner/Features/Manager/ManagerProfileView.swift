import SwiftUI
import UIKit

struct ManagerProfileView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    let user: AppUser
    let onLogout: () async -> Void
    let onDeleteAccount: () async -> Void

    @State private var didCopyId = false
    @State private var showDeleteConfirm = false
    @State private var isDeleting = false

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 24) {
                    identityCard
                    themeCardSection
                    languageCardSection

                    Button {
                        Task {
                            await onLogout()
                        }
                    } label: {
                        Text(localized("Log out", "Выйти"))
                    }
                    .buttonStyle(.plain)
                    .themePrimaryAction()

                    deleteAccountButton

                    Spacer(minLength: 0)
                }
                .padding()
            }
            .background(themeManager.selectedTheme.screenBackground.ignoresSafeArea())
            .navigationTitle(localized("Profile", "Профиль"))
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var identityCard: some View {
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

            VStack(spacing: 6) {
                Text(localized("User ID", "ID пользователя"))
                    .font(.caption)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                HStack(spacing: 8) {
                    Text(user.displayId)
                        .font(.footnote.monospaced())
                        .fontWeight(.semibold)
                        .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                        .lineLimit(1)
                        .truncationMode(.middle)

                    Button {
                        UIPasteboard.general.string = user.displayId
                        didCopyId = true
                    } label: {
                        Image(systemName: didCopyId ? "checkmark" : "doc.on.doc")
                            .font(.caption)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(themeManager.selectedTheme.accentColor)
                }
            }
            .padding(.top, 4)

            if let company = user.company {
                Text(company.name)
                    .font(.footnote.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(themeManager.selectedTheme.cardTint)
                    .clipShape(Capsule())
            }
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .themeCard()
    }

    private var themeCardSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(localized("App Theme", "Тема приложения"))
                .font(.title3)
                .fontWeight(.bold)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            ThemedSegmentedPicker(
                selection: $themeManager.selectedTheme,
                segments: AppTheme.allCases.map { ThemedSegment($0, $0.title) }
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .themeCard()
    }

    private var languageCardSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(localized("Language", "Язык"))
                .font(.title3)
                .fontWeight(.bold)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            ThemedSegmentedPicker(
                selection: $languageManager.selectedLanguage,
                segments: AppLanguage.allCases.map { ThemedSegment($0, $0.title) }
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .themeCard()
    }

    private var deleteAccountButton: some View {
        Button(role: .destructive) {
            showDeleteConfirm = true
        } label: {
            if isDeleting {
                ProgressView()
                    .frame(maxWidth: .infinity)
            } else {
                Text(localized("Delete account", "Удалить аккаунт"))
                    .frame(maxWidth: .infinity)
            }
        }
        .buttonStyle(.plain)
        .themeDestructiveAction()
        .disabled(isDeleting)
        .alert(
            localized("Delete account?", "Удалить аккаунт?"),
            isPresented: $showDeleteConfirm
        ) {
            Button(localized("Delete", "Удалить"), role: .destructive) {
                Task {
                    isDeleting = true
                    await onDeleteAccount()
                    isDeleting = false
                }
            }
            Button(localized("Cancel", "Отмена"), role: .cancel) {}
        } message: {
            Text(localized(
                "This permanently deletes your account and cannot be undone.",
                "Аккаунт будет удалён безвозвратно. Это действие нельзя отменить."
            ))
        }
    }
}
