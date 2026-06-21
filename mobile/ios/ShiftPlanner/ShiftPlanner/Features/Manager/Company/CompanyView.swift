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

    private var shouldShowCompanyAddress: Bool {
        (displayedCompany?.branches.isEmpty ?? true)
    }

    private var displayedAddress: String {
        guard let address = displayedCompany?.address?.trimmingCharacters(in: .whitespacesAndNewlines),
              !address.isEmpty else {
            return languageManager.text("Not added yet", "Пока не добавлен")
        }

        return address
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let company = displayedCompany {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(alignment: .top, spacing: 12) {
                                VStack(alignment: .leading, spacing: 8) {
                                    if viewModel.isEditing {
                                        TextField(languageManager.text("Company name", "Название компании"), text: $viewModel.companyName)
                                            .themeInputField()

                                        if shouldShowCompanyAddress {
                                            TextField(languageManager.text("Company address", "Адрес компании"), text: $viewModel.companyAddress, axis: .vertical)
                                                .lineLimit(2...4)
                                                .themeInputField()
                                        }
                                    } else {
                                        Text(company.name)
                                            .font(.title2)
                                            .bold()

                                        if shouldShowCompanyAddress {
                                            VStack(alignment: .leading, spacing: 4) {
                                                Text(languageManager.text("Address", "Адрес"))
                                                    .font(.subheadline)
                                                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                                                Text(displayedAddress)
                                                    .font(.body)
                                                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                                            }
                                        }
                                    }
                                }

                                Spacer()

                                if viewModel.isEditing {
                                    HStack(spacing: 8) {
                                        Button(languageManager.text("Cancel", "Отмена")) {
                                            viewModel.cancelEditing(with: company)
                                        }
                                        .buttonStyle(.plain)
                                        .themeSecondaryAction()

                                        Button {
                                            Task {
                                                if let updatedCompany = await viewModel.saveCompanyChanges(for: company) {
                                                    companyOverride = updatedCompany
                                                    onUserUpdated(user.withCompany(updatedCompany))
                                                }
                                            }
                                        } label: {
                                            if viewModel.isSaving {
                                                ProgressView()
                                                    .tint(themeManager.selectedTheme.primaryActionTextColor)
                                            } else {
                                                Text(languageManager.text("Save", "Сохранить"))
                                            }
                                        }
                                        .buttonStyle(.plain)
                                        .themePrimaryAction(isEnabled: viewModel.canSaveCompany)
                                        .disabled(!viewModel.canSaveCompany)
                                    }
                                } else {
                                    Button(languageManager.text("Edit", "Редактировать")) {
                                        viewModel.startEditing(with: company)
                                    }
                                    .buttonStyle(.plain)
                                    .themeSecondaryAction()
                                }
                            }

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
                    viewModel.configureForm(with: company)
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
