import SwiftUI

struct CompanySetupView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: CompanySetupViewModel
    let onCompanyCreated: ((AppCompany) -> Void)?

    init(
        repository: CompanyRepository = APICompanyRepository(),
        onCompanyCreated: ((AppCompany) -> Void)? = nil
    ) {
        self.onCompanyCreated = onCompanyCreated
        _viewModel = StateObject(wrappedValue: CompanySetupViewModel(repository: repository))
    }

    var body: some View {
        Form {
            Section("Company") {
                TextField("Company name", text: $viewModel.companyName)

                Toggle("Does the company have branches?", isOn: $viewModel.hasBranches)
                    .onChange(of: viewModel.hasBranches) { _, hasBranches in
                        if !hasBranches {
                            viewModel.allowsRotationBetweenBranches = false
                        }
                    }
            }

            if viewModel.hasBranches {
                Section("Branches") {
                    ForEach($viewModel.branches) { $branch in
                        VStack(alignment: .leading, spacing: 12) {
                            TextField("Branch name", text: $branch.name)
                            TextField("Branch address", text: $branch.address, axis: .vertical)
                                .lineLimit(2...4)

                            if viewModel.branches.count > 1 {
                                Button("Remove branch", role: .destructive) {
                                    viewModel.removeBranch(id: branch.id)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }

                    Button("Add branch") {
                        viewModel.addBranch()
                    }
                }

                Section("Policies") {
                    Toggle(
                        "Is employee rotation between branches allowed?",
                        isOn: $viewModel.allowsRotationBetweenBranches
                    )
                }
            } else {
                Section("Address") {
                    TextField("Company address", text: $viewModel.companyAddress, axis: .vertical)
                        .lineLimit(2...4)
                }
            }

            Section {
                Button {
                    Task {
                        await viewModel.createCompany()
                        if let createdCompany = viewModel.createdCompany {
                            onCompanyCreated?(createdCompany)
                            dismiss()
                        }
                    }
                } label: {
                    if viewModel.isSaving {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Create company")
                            .frame(maxWidth: .infinity)
                    }
                }
                .disabled(viewModel.isSaving || !viewModel.canCreateCompany)
            } footer: {
                Text("For now the backend accepts only the company name. The rest of the form is collected for the upcoming expansion.")
            }

            if let errorMessage = viewModel.errorMessage {
                Section {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                }
            }
        }
        .navigationTitle("Create Company")
    }
}
