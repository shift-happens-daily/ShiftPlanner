import SwiftUI

enum CompanyInviteMode: Equatable {
    case employeeJoin
    case managerInvite
}

struct CompanyInviteView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var themeManager: ThemeManager
    @StateObject private var viewModel: CompanyInviteViewModel

    let mode: CompanyInviteMode
    let onUserJoined: ((AppUser) -> Void)?

    init(
        mode: CompanyInviteMode,
        repository: CompanyRepository = APICompanyRepository(),
        onUserJoined: ((AppUser) -> Void)? = nil
    ) {
        self.mode = mode
        self.onUserJoined = onUserJoined
        _viewModel = StateObject(wrappedValue: CompanyInviteViewModel(repository: repository))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(localized("Invite code", "Код приглашения")) {
                    TextField(localized("Enter invite code", "Введите код приглашения"), text: $viewModel.inviteCode)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled(true)
                        .themeInputField()

                    Button {
                        Task {
                            await viewModel.previewCompany()
                        }
                    } label: {
                        if viewModel.isLoading {
                            ProgressView()
                                .tint(themeManager.selectedTheme.primaryActionTextColor)
                        } else {
                            Text(localized("Preview company", "Предпросмотр компании"))
                        }
                    }
                    .buttonStyle(.plain)
                    .themePrimaryAction(isEnabled: !viewModel.isLoading)
                    .disabled(viewModel.isLoading)
                }

                if let preview = viewModel.preview {
                    Section(localized("Preview", "Предпросмотр")) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(preview.name)
                                .font(.headline)
                                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                            Text(localized("Invite code: ", "Код приглашения: ") + preview.inviteCode)
                                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                            if !preview.branches.isEmpty {
                                Text(localized("Branches: ", "Филиалы: ") + preview.branches.map(\.name).joined(separator: ", "))
                                    .font(.footnote)
                            }

                            if !preview.positions.isEmpty {
                                Text(localized("Positions: ", "Должности: ") + preview.positions.map(\.name).joined(separator: ", "))
                                    .font(.footnote)
                            }
                        }
                        .padding(.vertical, 4)
                    }

                    if mode == .employeeJoin {
                        Section {
                            Button {
                                Task {
                                    await viewModel.joinCompany()
                                    if let joinedUser = viewModel.joinedUser {
                                        onUserJoined?(joinedUser)
                                        dismiss()
                                    }
                                }
                            } label: {
                                if viewModel.isLoading {
                                    ProgressView()
                                        .tint(themeManager.selectedTheme.primaryActionTextColor)
                                } else {
                                    Text(localized("Join company", "Присоединиться"))
                                }
                            }
                            .buttonStyle(.plain)
                            .themePrimaryAction(isEnabled: !viewModel.isLoading)
                            .disabled(viewModel.isLoading)
                        }
                    } else {
                        Section {
                            Button {
                                Task {
                                    await viewModel.joinAsManager()
                                    if let joinedUser = viewModel.joinedUser {
                                        onUserJoined?(joinedUser)
                                        dismiss()
                                    }
                                }
                            } label: {
                                if viewModel.isLoading {
                                    ProgressView()
                                        .tint(themeManager.selectedTheme.primaryActionTextColor)
                                } else {
                                    Text(localized("Send join request", "Отправить запрос"))
                                }
                            }
                            .buttonStyle(.plain)
                            .themePrimaryAction(isEnabled: !viewModel.isLoading)
                            .disabled(viewModel.isLoading)

                            Text(localized(
                                "An existing manager needs to approve your request before you can access the company.",
                                "Действующий менеджер должен одобрить запрос, прежде чем вы получите доступ к компании."
                            ))
                                .font(.footnote)
                                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        }
                    }
                }

                if let errorMessage = viewModel.errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(themeManager.selectedTheme.destructiveColor)
                    }
                }
            }
            .navigationTitle(mode == .employeeJoin
                ? localized("Join Company", "Присоединиться к компании")
                : localized("Invite Code", "Код приглашения"))
            .navigationBarTitleDisplayMode(.inline)
            .scrollContentBackground(.hidden)
            .background(themeManager.selectedTheme.screenBackground)
        }
    }
}
