import SwiftUI

enum CompanyInviteMode: Equatable {
    case employeeJoin
    case managerInvite
}

struct CompanyInviteView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
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
                Section(languageManager.text("Invite code", "Инвайт-код")) {
                    TextField(languageManager.text("Enter invite code", "Введите код"), text: $viewModel.inviteCode)
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
                            Text(languageManager.text("Preview company", "Показать компанию"))
                        }
                    }
                    .buttonStyle(.plain)
                    .themePrimaryAction(isEnabled: !viewModel.isLoading)
                    .disabled(viewModel.isLoading)
                }

                if let preview = viewModel.preview {
                    Section(languageManager.text("Preview", "Предпросмотр")) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(preview.name)
                                .font(.headline)
                                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                            Text("\(languageManager.text("Invite code", "Инвайт-код")): \(preview.inviteCode)")
                                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                            if !preview.branches.isEmpty {
                                Text("\(languageManager.text("Branches", "Филиалы")): \(preview.branches.map(\.name).joined(separator: ", "))")
                                    .font(.footnote)
                            }

                            if !preview.positions.isEmpty {
                                Text("\(languageManager.text("Positions", "Должности")): \(preview.positions.map(\.name).joined(separator: ", "))")
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
                                    Text(languageManager.text("Join company", "Присоединиться"))
                                }
                            }
                            .buttonStyle(.plain)
                            .themePrimaryAction(isEnabled: !viewModel.isLoading)
                            .disabled(viewModel.isLoading)
                        }
                    } else {
                        Section {
                            Text(languageManager.text("Manager join by invite code will be enabled once the backend supports multi-manager membership.", "Вход менеджера по инвайт-коду появится, когда бэкенд начнет поддерживать несколько менеджеров в компании."))
                                .font(.footnote)
                                .foregroundStyle(.secondary)
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
            .navigationTitle(mode == .employeeJoin ? languageManager.text("Join Company", "Вступить в компанию") : languageManager.text("Invite Code", "Инвайт-код"))
            .navigationBarTitleDisplayMode(.inline)
            .scrollContentBackground(.hidden)
            .background(themeManager.selectedTheme.screenBackground)
        }
    }
}
