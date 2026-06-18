import SwiftUI
import UIKit

struct CompanyView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel = CompanyDetailsViewModel()
    let user: AppUser
    let onUserUpdated: (AppUser) -> Void

    @State private var companyOverride: AppCompany?
    @State private var didCopyInviteCode = false

    private var displayedCompany: AppCompany? {
        let baseCompany = companyOverride ?? user.company?.asAppCompany()

        guard let baseCompany else { return nil }
        guard !viewModel.branches.isEmpty else { return baseCompany }
        return baseCompany.withBranches(viewModel.branches)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let company = displayedCompany {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(company.name)
                                .font(.title2)
                                .bold()

                            if viewModel.isLoading {
                                ProgressView()
                                    .tint(themeManager.selectedTheme.accentColor)
                            }

                            VStack(alignment: .leading, spacing: 8) {
                                Text(languageManager.text("Invite code", "Инвайт-код"))
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)

                                Text(company.inviteCode)
                                    .font(.title3.monospaced())
                                    .fontWeight(.semibold)
                            }

                            HStack(spacing: 12) {
                                Button(didCopyInviteCode ? languageManager.text("Copied", "Скопировано") : languageManager.text("Copy code", "Скопировать")) {
                                    UIPasteboard.general.string = company.inviteCode
                                    didCopyInviteCode = true
                                }
                                .buttonStyle(.plain)
                                .themeSecondaryAction()

                                ShareLink(
                                    item: languageManager.text(
                                        "Join \(company.name) in ShiftPlanner with invite code: \(company.inviteCode)",
                                        "Присоединяйтесь к \(company.name) в ShiftPlanner по коду: \(company.inviteCode)"
                                    ),
                                    subject: Text(languageManager.text("ShiftPlanner invite", "Инвайт ShiftPlanner"))
                                ) {
                                    Label(languageManager.text("Share", "Поделиться"), systemImage: "square.and.arrow.up")
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(themeManager.selectedTheme.primaryActionFillColor)
                            }

                            Text(languageManager.text("Share this code with employees so they can join the company.", "Поделитесь этим кодом с сотрудниками, чтобы они могли присоединиться к компании."))
                                .font(.footnote)
                                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                            VStack(alignment: .leading, spacing: 8) {
                                Text(languageManager.text("Branches", "Филиалы"))
                                    .font(.headline)
                                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                                if company.branches.isEmpty {
                                    Text(languageManager.text("No branches have been added yet.", "Филиалы пока не добавлены."))
                                        .font(.subheadline)
                                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                                } else {
                                    ForEach(company.branches) { branch in
                                        HStack(spacing: 10) {
                                            Circle()
                                                .fill(themeManager.selectedTheme.accentColor)
                                                .frame(width: 6, height: 6)

                                            Text(branch.name)
                                                .font(.subheadline)
                                                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                                        }
                                    }
                                }
                            }

                            if let errorMessage = viewModel.errorMessage {
                                Text(errorMessage)
                                    .font(.footnote)
                                    .foregroundStyle(themeManager.selectedTheme.destructiveColor)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .themeCard()
                    } else {
                        ManagerCompanyAccessContentView(
                            user: user,
                            onUserUpdated: { updatedUser in
                                companyOverride = updatedUser.company?.asAppCompany()
                                onUserUpdated(updatedUser)
                            }
                        )
                    }
                }
                .padding()
            }
            .background(themeManager.selectedTheme.screenBackground)
            .navigationTitle(languageManager.text("Company", "Компания"))
            .navigationBarTitleDisplayMode(.inline)
            .task(id: displayedCompany?.id) {
                if let company = displayedCompany {
                    await viewModel.loadBranches(for: company.id)
                } else {
                    viewModel.reset()
                }
            }
            .onChange(of: user.company?.inviteCode) { _, _ in
                if let company = user.company?.asAppCompany() {
                    companyOverride = company
                }
            }
        }
    }
}
