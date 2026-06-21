import SwiftUI

struct CompanySetupView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
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
            Section(languageManager.text("Company", "Компания")) {
                TextField(languageManager.text("Company name", "Название компании"), text: $viewModel.companyName)
                    .themeInputField()

                Toggle(languageManager.text("Does the company have branches?", "Есть ли у компании филиалы?"), isOn: $viewModel.hasBranches)
                    .onChange(of: viewModel.hasBranches) { _, hasBranches in
                        if !hasBranches {
                            viewModel.allowsRotationBetweenBranches = false
                        }
                    }
            }

            if viewModel.hasBranches {
                Section(languageManager.text("Branches", "Филиалы")) {
                    ForEach($viewModel.branches) { $branch in
                        VStack(alignment: .leading, spacing: 12) {
                            TextField(languageManager.text("Branch name", "Название филиала"), text: $branch.name)
                                .themeInputField()
                            TextField(languageManager.text("Branch address", "Адрес филиала"), text: $branch.address, axis: .vertical)
                                .lineLimit(2...4)
                                .themeInputField()

                            if viewModel.branches.count > 1 {
                                Button(languageManager.text("Remove branch", "Удалить филиал"), role: .destructive) {
                                    viewModel.removeBranch(id: branch.id)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }

                    Button(languageManager.text("Add branch", "Добавить филиал")) {
                        viewModel.addBranch()
                    }
                }

                Section(languageManager.text("Policies", "Политики")) {
                    Toggle(
                        languageManager.text("Is employee rotation between branches allowed?", "Возможна ли ротация сотрудников между филиалами?"),
                        isOn: $viewModel.allowsRotationBetweenBranches
                    )
                }
            } else {
                Section(languageManager.text("Address", "Адрес")) {
                    TextField(languageManager.text("Company address", "Адрес компании"), text: $viewModel.companyAddress, axis: .vertical)
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
                        Text(languageManager.text("Create company", "Создать компанию"))
                    }
                }
                .buttonStyle(.plain)
                .themePrimaryAction(isEnabled: !viewModel.isSaving && viewModel.canCreateCompany)
                .disabled(viewModel.isSaving || !viewModel.canCreateCompany)
            } footer: {
                Text(languageManager.text("The backend now saves the company name and address. Branch details are still collected for the upcoming expansion.", "Бэкенд теперь сохраняет название и адрес компании. Детали по филиалам пока собираются под будущее расширение."))
            }

            if let errorMessage = viewModel.errorMessage {
                Section {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                }
            }
        }
        .navigationTitle(languageManager.text("Create Company", "Создать компанию"))
        .navigationBarTitleDisplayMode(.inline)
        .scrollContentBackground(.hidden)
        .background(themeManager.selectedTheme.screenBackground)
    }
}
