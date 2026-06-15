import SwiftUI

enum CompanyInviteMode: Equatable {
    case employeeJoin
    case managerInvite
}

struct CompanyInviteView: View {
    @Environment(\.dismiss) private var dismiss
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
                Section("Invite code") {
                    TextField("Enter invite code", text: $viewModel.inviteCode)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled(true)

                    Button {
                        Task {
                            await viewModel.previewCompany()
                        }
                    } label: {
                        if viewModel.isLoading {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Text("Preview company")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(viewModel.isLoading)
                }

                if let preview = viewModel.preview {
                    Section("Preview") {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(preview.name)
                                .font(.headline)
                            Text("Invite code: \(preview.inviteCode)")
                                .foregroundStyle(.secondary)

                            if !preview.branches.isEmpty {
                                Text("Branches: \(preview.branches.map(\.name).joined(separator: ", "))")
                                    .font(.footnote)
                            }

                            if !preview.positions.isEmpty {
                                Text("Positions: \(preview.positions.map(\.name).joined(separator: ", "))")
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
                                        .frame(maxWidth: .infinity)
                                } else {
                                    Text("Join company")
                                        .frame(maxWidth: .infinity)
                                }
                            }
                            .disabled(viewModel.isLoading)
                        }
                    } else {
                        Section {
                            Text("Manager join by invite code will be enabled once the backend supports multi-manager membership.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                if let errorMessage = viewModel.errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(mode == .employeeJoin ? "Join Company" : "Invite Code")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
