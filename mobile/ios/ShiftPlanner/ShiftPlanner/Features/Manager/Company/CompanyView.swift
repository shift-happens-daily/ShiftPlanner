import SwiftUI
import UIKit

struct CompanyView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    let user: AppUser
    let onUserUpdated: (AppUser) -> Void

    @State private var isShowingInviteSheet = false
    @State private var companyOverride: AppCompany?
    @State private var didCopyInviteCode = false
    @State private var showNotifications = false

    private var displayedCompany: AppCompany? {
        companyOverride ?? user.company?.asAppCompany()
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if user.isManagerPending {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(localized("Waiting for approval", "Ожидание одобрения"))
                                .font(.title3)
                                .bold()
                                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                            Text(localized(
                                "Your request to join the company has been sent. A manager needs to approve it before you can access the company.",
                                "Ваш запрос на присоединение к компании отправлен. Менеджер должен одобрить его, прежде чем вы получите доступ."
                            ))
                                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .themeCard()
                    } else if let company = displayedCompany {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(company.name)
                                .font(.title2)
                                .bold()

                            VStack(alignment: .leading, spacing: 8) {
                                Text(localized("Invite code", "Код приглашения"))
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)

                                Text(company.inviteCode)
                                    .font(.title3.monospaced())
                                    .fontWeight(.semibold)
                            }

                            HStack(spacing: 12) {
                                Button(didCopyInviteCode
                                    ? localized("Copied", "Скопировано")
                                    : localized("Copy code", "Копировать код")) {
                                    UIPasteboard.general.string = company.inviteCode
                                    didCopyInviteCode = true
                                }
                                .buttonStyle(.plain)
                                .themeSecondaryAction()

                                ShareLink(
                                    item: localized(
                                        "Join \(company.name) in ShiftPlanner with invite code: \(company.inviteCode)",
                                        "Присоединяйтесь к «\(company.name)» в ShiftPlanner по коду приглашения: \(company.inviteCode)"
                                    ),
                                    subject: Text("ShiftPlanner invite")
                                ) {
                                    Label(localized("Share", "Поделиться"), systemImage: "square.and.arrow.up")
                                }
                                .buttonStyle(.plain)
                                .themeSecondaryAction()
                            }

                            Text(localized(
                                "Share this code with employees so they can join the company.",
                                "Поделитесь этим кодом с сотрудниками, чтобы они присоединились к компании."
                            ))
                                .font(.footnote)
                                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .themeCard()

                        NavigationLink {
                            CompanyManageView(onCompanyUpdated: { updated in
                                companyOverride = updated
                            })
                        } label: {
                            Label(
                                localized("Manage company & branches", "Компания и филиалы"),
                                systemImage: "building.2.crop.circle"
                            )
                        }
                        .buttonStyle(.plain)
                        .themeSecondaryAction()
                    } else {
                        VStack(alignment: .leading, spacing: 16) {
                            Text(localized("You are not attached to a company yet.", "Вы ещё не привязаны к компании."))
                                .font(.title3)
                                .bold()
                                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                            Text(localized(
                                "You can enter an invite code if your company already exists, or create a new company.",
                                "Вы можете ввести код приглашения, если компания уже существует, или создать новую."
                            ))
                                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        }

                        VStack(alignment: .leading, spacing: 12) {
                            Text(localized("Join by invite code", "Присоединиться по коду"))
                                .font(.headline)
                                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                            Text(localized(
                                "Useful when your company already exists or when multiple managers will be supported.",
                                "Полезно, если компания уже существует или будет поддержка нескольких менеджеров."
                            ))
                                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                            Button(localized("Enter invite code", "Ввести код приглашения")) {
                                isShowingInviteSheet = true
                            }
                            .buttonStyle(.plain)
                            .themeSecondaryAction()
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .themeCard()

                        VStack(alignment: .leading, spacing: 12) {
                            Text(localized("Create a company", "Создать компанию"))
                                .font(.headline)
                                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                            Text(localized(
                                "Set up the company name now and prepare branch data for the upcoming backend expansion.",
                                "Задайте название компании и подготовьте данные о филиалах."
                            ))
                                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                            NavigationLink(localized("Open company setup", "Открыть настройку компании")) {
                                CompanySetupView { createdCompany in
                                    companyOverride = createdCompany
                                }
                            }
                            .buttonStyle(.plain)
                            .themePrimaryAction()
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .themeCard()
                    }
                }
                .padding()
            }
            .background(themeManager.selectedTheme.screenBackground)
            .navigationTitle(localized("Company", "Компания"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showNotifications = true
                    } label: {
                        Image(systemName: "bell")
                    }
                }
            }
            .sheet(isPresented: $showNotifications) {
                NotificationsView(companyId: user.company?.id)
                    .environmentObject(themeManager)
            }
            .onChange(of: user.company?.inviteCode) { _, _ in
                if let company = user.company?.asAppCompany() {
                    companyOverride = company
                }
            }
            .sheet(isPresented: $isShowingInviteSheet) {
                CompanyInviteView(
                    mode: .managerInvite,
                    onUserJoined: onUserUpdated
                )
            }
        }
    }
}
