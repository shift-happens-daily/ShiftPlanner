import SwiftUI

struct CompanySetupView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var themeManager: ThemeManager
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
            Section(localized("Company", "Компания")) {
                TextField(localized("Company name", "Название компании"), text: $viewModel.companyName)
                    .themeInputField()

                Toggle(localized("Does the company have branches?", "У компании есть филиалы?"), isOn: $viewModel.hasBranches)
                    .onChange(of: viewModel.hasBranches) { _, hasBranches in
                        if !hasBranches {
                            viewModel.allowsRotationBetweenBranches = false
                        }
                    }
            }

            if viewModel.hasBranches {
                Section(localized("Branches", "Филиалы")) {
                    ForEach($viewModel.branches) { $branch in
                        VStack(alignment: .leading, spacing: 12) {
                            TextField(localized("Branch name", "Название филиала"), text: $branch.name)
                                .themeInputField()
                            TextField(localized("Branch address", "Адрес филиала"), text: $branch.address, axis: .vertical)
                                .lineLimit(2...4)
                                .themeInputField()

                            if viewModel.branches.count > 1 {
                                Button(localized("Remove branch", "Удалить филиал"), role: .destructive) {
                                    viewModel.removeBranch(id: branch.id)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }

                    Button(localized("Add branch", "Добавить филиал")) {
                        viewModel.addBranch()
                    }
                }

                Section(localized("Policies", "Политики")) {
                    Toggle(
                        localized("Is employee rotation between branches allowed?", "Разрешена ли ротация сотрудников между филиалами?"),
                        isOn: $viewModel.allowsRotationBetweenBranches
                    )
                }
            } else {
                Section(localized("Address", "Адрес")) {
                    TextField(localized("Company address", "Адрес компании"), text: $viewModel.companyAddress, axis: .vertical)
                        .lineLimit(2...4)
                        .themeInputField()
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
                            .tint(themeManager.selectedTheme.primaryActionTextColor)
                    } else {
                        Text(localized("Create company", "Создать компанию"))
                    }
                }
                .buttonStyle(.plain)
                .themePrimaryAction(isEnabled: !viewModel.isSaving && viewModel.canCreateCompany)
                .disabled(viewModel.isSaving || !viewModel.canCreateCompany)
            } footer: {
                Text(localized(
                    "The company is created with its name. You can add branches afterwards in Company & branches.",
                    "Компания создаётся с названием. Филиалы можно добавить позже в разделе «Компания и филиалы»."
                ))
            }

            if let errorMessage = viewModel.errorMessage {
                Section {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                }
            }
        }
        .navigationTitle(localized("Create Company", "Создание компании"))
        .navigationBarTitleDisplayMode(.inline)
        .scrollContentBackground(.hidden)
        .background(themeManager.selectedTheme.screenBackground)
    }
}
