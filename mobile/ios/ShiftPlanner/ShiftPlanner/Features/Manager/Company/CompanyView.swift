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

    private let inviteActionColumns = [
        GridItem(.adaptive(minimum: 132), spacing: 10, alignment: .leading)
    ]

    private var displayedCompany: AppCompany? {
        companyOverride ?? viewModel.company ?? user.company?.asAppCompany()
    }

    private var shareInviteMessage: String {
        guard let company = displayedCompany else { return "" }
        return languageManager.text(
            "Join \(company.name) in ShiftPlanner with invite code: \(company.inviteCode)",
            "Присоединяйтесь к \(company.name) в ShiftPlanner по коду: \(company.inviteCode)"
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let company = displayedCompany {
                        companyContent(company)
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
            .task {
                guard user.company != nil else {
                    viewModel.reset()
                    return
                }

                await viewModel.loadCompany()
                syncLoadedCompanyToUser()
            }
            .onChange(of: user.company?.inviteCode) { _, _ in
                if let company = user.company?.asAppCompany() {
                    companyOverride = company
                }
            }
            .onChange(of: displayedCompany?.inviteCode) { _, _ in
                didCopyInviteCode = false
            }
        }
    }

    @ViewBuilder
    private func companyContent(_ company: AppCompany) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            headerSection(company)
            branchSection(company)

            if !viewModel.isEditing {
                inviteCodeSection(company)
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
    }

    @ViewBuilder
    private func headerSection(_ company: AppCompany) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 10) {
                    if viewModel.isEditing {
                        TextField(languageManager.text("Company name", "Название компании"), text: $viewModel.companyName)
                            .themeInputField()

                        if viewModel.shouldShowCompanyAddressField {
                            TextField(languageManager.text("Company address", "Адрес компании"), text: $viewModel.companyAddress, axis: .vertical)
                                .lineLimit(2...4)
                                .themeInputField()
                        }
                    } else {
                        Text(company.name)
                            .font(.title2)
                            .bold()
                            .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                        if company.branches.isEmpty {
                            detailRow(
                                title: languageManager.text("Address", "Адрес"),
                                value: company.address?.trimmedNonEmpty ?? languageManager.text("Not added yet", "Пока не добавлен")
                            )
                        }
                    }
                }

                Spacer(minLength: 8)

                if viewModel.isEditing {
                    VStack(spacing: 8) {
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
                                Label(languageManager.text("Save", "Сохранить"), systemImage: "checkmark")
                            }
                        }
                        .buttonStyle(.plain)
                        .companyPrimaryActionChip(themeManager: themeManager, isEnabled: viewModel.canSaveCompany)
                        .frame(minWidth: 124)
                        .disabled(!viewModel.canSaveCompany)

                        Button {
                            viewModel.cancelEditing(with: company)
                        } label: {
                            Label(languageManager.text("Cancel", "Отмена"), systemImage: "xmark")
                        }
                        .buttonStyle(.plain)
                        .companyActionChip(themeManager: themeManager)
                        .frame(minWidth: 124)
                    }
                } else {
                    Button {
                        viewModel.startEditing(with: company)
                    } label: {
                        Label(languageManager.text("Edit", "Редактировать"), systemImage: "pencil")
                    }
                    .buttonStyle(.plain)
                    .companyActionChip(themeManager: themeManager)
                    .disabled(!viewModel.isReadyForEditing)
                }
            }

            if viewModel.isLoading {
                ProgressView()
                    .tint(themeManager.selectedTheme.accentColor)
            } else if viewModel.company == nil {
                Text(languageManager.text("Loading full company details before editing.", "Загружаем полные данные компании перед редактированием."))
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }
        }
    }

    @ViewBuilder
    private func inviteCodeSection(_ company: AppCompany) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(languageManager.text("Invite code", "Инвайт-код"))
                .font(.headline)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            Text(company.inviteCode)
                .font(.title3.monospaced())
                .fontWeight(.semibold)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            if let generatedText = formattedInviteDate(company.inviteCodeGeneratedAt) {
                detailRow(
                    title: languageManager.text("Generated", "Сгенерирован"),
                    value: generatedText
                )
            }

            if let expiresText = formattedInviteDate(company.inviteCodeExpiresAt) {
                detailRow(
                    title: languageManager.text("Expires", "Истекает"),
                    value: expiresText
                )
            }

            LazyVGrid(columns: inviteActionColumns, alignment: .leading, spacing: 10) {
                Button {
                    UIPasteboard.general.string = company.inviteCode
                    didCopyInviteCode = true
                } label: {
                    Label(
                        didCopyInviteCode
                        ? languageManager.text("Copied", "Скопировано")
                        : languageManager.text("Copy code", "Скопировать"),
                        systemImage: didCopyInviteCode ? "checkmark" : "doc.on.doc"
                    )
                }
                .buttonStyle(.plain)
                .companyActionChip(themeManager: themeManager)

                ShareLink(
                    item: shareInviteMessage,
                    subject: Text(languageManager.text("ShiftPlanner invite", "Инвайт ShiftPlanner"))
                ) {
                    Label(languageManager.text("Share", "Поделиться"), systemImage: "square.and.arrow.up")
                }
                .buttonStyle(.plain)
                .companyActionChip(themeManager: themeManager)

                Button {
                    Task {
                        if let regeneratedCompany = await viewModel.regenerateInviteCode() {
                            companyOverride = regeneratedCompany
                            onUserUpdated(user.withCompany(regeneratedCompany))
                        }
                    }
                } label: {
                    if viewModel.isRegeneratingInviteCode {
                        ProgressView()
                            .tint(themeManager.selectedTheme.accentColor)
                    } else {
                        Label(languageManager.text("Regenerate", "Обновить код"), systemImage: "arrow.clockwise")
                    }
                }
                .buttonStyle(.plain)
                .companyActionChip(themeManager: themeManager)
                .disabled(viewModel.isRegeneratingInviteCode)
            }

            Text(languageManager.text("Share this code with employees so they can join the company.", "Поделитесь этим кодом с сотрудниками, чтобы они могли присоединиться к компании."))
                .font(.footnote)
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
        }
    }

    @ViewBuilder
    private func branchSection(_ company: AppCompany) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(languageManager.text("Branches", "Филиалы"))
                    .font(.headline)
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                Spacer()

                if viewModel.isEditing {
                    Button {
                        viewModel.addBranchDraft()
                    } label: {
                        Label(languageManager.text("Add branch", "Добавить филиал"), systemImage: "plus")
                    }
                    .buttonStyle(.plain)
                    .companyActionChip(themeManager: themeManager)
                }
            }

            if viewModel.isEditing {
                if viewModel.branchDrafts.isEmpty {
                    Text(languageManager.text("No branches added. Company address will be used instead.", "Филиалы не добавлены. Вместо них будет использоваться адрес компании."))
                        .font(.footnote)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                } else {
                    ForEach($viewModel.branchDrafts) { $branch in
                        editableBranchCard(branch: $branch)
                    }
                }
            } else if company.branches.isEmpty {
                Text(languageManager.text("No branches have been added yet.", "Филиалы пока не добавлены."))
                    .font(.subheadline)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            } else {
                ForEach(company.branches) { branch in
                    branchCard(branch)
                }
            }
        }
    }

    private func branchCard(_ branch: AppBranchOption) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(branch.name)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            if let address = branch.address?.trimmedNonEmpty {
                Text(address)
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(themeManager.selectedTheme.cardTint)
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func editableBranchCard(branch: Binding<CompanyBranchDraft>) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 8) {
                TextField(languageManager.text("Branch name", "Название филиала"), text: branch.name)
                    .themeInputField()

                if viewModel.branchDrafts.count > 1 {
                    Button {
                        viewModel.removeBranchDraft(id: branch.wrappedValue.id)
                    } label: {
                        Image(systemName: "xmark")
                            .font(.caption.weight(.bold))
                            .frame(width: 16, height: 16)
                            .padding(10)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(themeManager.selectedTheme.accentColor)
                    .background(themeManager.selectedTheme.elevatedSurfaceColor)
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }

            TextField(languageManager.text("Branch address", "Адрес филиала"), text: branch.address, axis: .vertical)
                .lineLimit(2...4)
                .themeInputField()
        }
        .padding(14)
        .background(themeManager.selectedTheme.cardTint)
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func detailRow(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            Text(value)
                .font(.body)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
        }
    }

    private func formattedInviteDate(_ date: Date?) -> String? {
        guard let date else { return nil }

        let formatter = DateFormatter()
        formatter.locale = LanguageManager.storedLocale
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private func syncLoadedCompanyToUser() {
        guard let loadedCompany = viewModel.company else { return }
        guard companyOverride != loadedCompany else { return }
        companyOverride = loadedCompany
        onUserUpdated(user.withCompany(loadedCompany))
    }
}

private extension String {
    var trimmedNonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

private extension View {
    func companyActionChip(themeManager: ThemeManager) -> some View {
        font(.subheadline)
            .fontWeight(.semibold)
            .lineLimit(1)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .foregroundStyle(themeManager.selectedTheme.accentColor)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(themeManager.selectedTheme.cardTint)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(themeManager.selectedTheme.accentColor.opacity(0.22), lineWidth: 1)
            }
            .fixedSize(horizontal: true, vertical: false)
    }

    func companyPrimaryActionChip(themeManager: ThemeManager, isEnabled: Bool) -> some View {
        font(.subheadline)
            .fontWeight(.semibold)
            .lineLimit(1)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .foregroundStyle(themeManager.selectedTheme.primaryActionTextColor)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(
                        isEnabled
                        ? themeManager.selectedTheme.primaryActionFillColor
                        : themeManager.selectedTheme.secondaryTextColor.opacity(0.45)
                    )
            )
            .fixedSize(horizontal: true, vertical: false)
    }
}
