import SwiftUI

struct CompanyManageView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel = CompanyDetailsViewModel()

    let onCompanyUpdated: (AppCompany) -> Void

    @State private var workingHoursBranch: AppBranchOption? = nil

    var body: some View {
        Form {
            if viewModel.isLoading && viewModel.company == nil {
                ProgressView()
            } else if let company = viewModel.company {
                if viewModel.isEditing {
                    editingSections(company)
                } else {
                    readOnlySections(company)
                }
            }

            if let errorMessage = viewModel.errorMessage {
                Section {
                    Text(errorMessage).foregroundStyle(.red)
                }
            }
        }
        .navigationTitle(languageManager.text("Company & branches", "Компания и филиалы"))
        .navigationBarTitleDisplayMode(.inline)
        .scrollContentBackground(.hidden)
        .background(themeManager.selectedTheme.screenBackground)
        .task { await viewModel.loadCompany() }
    }

    // MARK: - Read-only

    @ViewBuilder
    private func readOnlySections(_ company: AppCompany) -> some View {
        Section(languageManager.text("Company", "Компания")) {
            Text(company.name)
                .font(.headline)
            if let address = company.address, !address.isEmpty {
                Text(address)
                    .font(.subheadline)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }
        }

        Section(languageManager.text("Invite code", "Код приглашения")) {
            Text(company.inviteCode)
                .font(.title3.monospaced())
                .fontWeight(.semibold)

            Button {
                Task {
                    if let updated = await viewModel.regenerateInviteCode() {
                        onCompanyUpdated(updated)
                    }
                }
            } label: {
                if viewModel.isRegeneratingInviteCode {
                    ProgressView()
                } else {
                    Text(languageManager.text("Regenerate code", "Сгенерировать новый код"))
                }
            }
            .disabled(viewModel.isRegeneratingInviteCode)
        }

        Section(languageManager.text("Branches", "Филиалы")) {
            if company.branches.isEmpty {
                Text(languageManager.text("No branches.", "Филиалов нет."))
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            } else {
                ForEach(company.branches) { branch in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(branch.name)
                            if let address = branch.address, !address.isEmpty {
                                Text(address)
                                    .font(.caption)
                                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                            }
                        }
                        Spacer()
                        Button {
                            workingHoursBranch = branch
                        } label: {
                            Image(systemName: "clock")
                                .foregroundStyle(themeManager.selectedTheme.accentColor)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .sheet(item: $workingHoursBranch) { branch in
            BranchWorkingHoursSheet(companyId: company.id, branch: branch)
                .environmentObject(themeManager)
                .environmentObject(languageManager)
        }

        Section {
            Button(languageManager.text("Edit", "Изменить")) {
                viewModel.startEditing(with: company)
            }
        }
    }

    // MARK: - Editing

    @ViewBuilder
    private func editingSections(_ company: AppCompany) -> some View {
        Section(languageManager.text("Company", "Компания")) {
            TextField(languageManager.text("Company name", "Название компании"), text: $viewModel.companyName)
            if viewModel.shouldShowCompanyAddressField {
                TextField(languageManager.text("Company address", "Адрес компании"), text: $viewModel.companyAddress, axis: .vertical)
                    .lineLimit(2...4)
            }
        }

        Section(languageManager.text("Branches", "Филиалы")) {
            ForEach($viewModel.branchDrafts) { $draft in
                VStack(alignment: .leading, spacing: 8) {
                    TextField(languageManager.text("Branch name", "Название филиала"), text: $draft.name)
                    TextField(languageManager.text("Branch address", "Адрес филиала"), text: $draft.address, axis: .vertical)
                        .lineLimit(1...3)
                    Button(languageManager.text("Remove branch", "Удалить филиал"), role: .destructive) {
                        viewModel.removeBranchDraft(id: draft.id)
                    }
                    .font(.footnote)
                }
                .padding(.vertical, 4)
            }

            Button(languageManager.text("Add branch", "Добавить филиал")) {
                viewModel.addBranchDraft()
            }
        }

        Section {
            Button {
                Task {
                    if let updated = await viewModel.saveCompanyChanges(for: company) {
                        onCompanyUpdated(updated)
                    }
                }
            } label: {
                if viewModel.isSaving {
                    ProgressView().frame(maxWidth: .infinity)
                } else {
                    Text(languageManager.text("Save", "Сохранить")).frame(maxWidth: .infinity)
                }
            }
            .disabled(!viewModel.canSaveCompany)

            Button(languageManager.text("Cancel", "Отмена"), role: .cancel) {
                viewModel.cancelEditing(with: company)
            }
        }
    }
}

// MARK: - Branch working hours editor

private struct BranchWorkingHoursSheet: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @Environment(\.dismiss) private var dismiss

    let companyId: Int
    let branch: AppBranchOption

    private let repository: CompanyRepository = APICompanyRepository()

    @State private var hours: [Int: DayWorkingHours] = [:]
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var errorMessage: String? = nil

    private var weekdayLabels: [String] {
        let formatter = DateFormatter()
        formatter.locale = languageManager.locale
        return formatter.shortWeekdaySymbols
            .map { $0.capitalized }
            .reorderedFromSundayToMonday()
    }

    var body: some View {
        NavigationStack {
            Form {
                if isLoading {
                    ProgressView()
                } else {
                    Section(branch.name) {
                        ForEach(0..<7, id: \.self) { weekday in
                            weekdayRow(weekday)
                        }
                    }

                    Section {
                        Button {
                            Task { await save() }
                        } label: {
                            if isSaving {
                                ProgressView().frame(maxWidth: .infinity)
                            } else {
                                Text(languageManager.text("Save", "Сохранить")).frame(maxWidth: .infinity)
                            }
                        }
                        .disabled(isSaving)
                    }
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(languageManager.text("Working hours", "Рабочие часы"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(languageManager.text("Cancel", "Отмена")) { dismiss() }
                }
            }
            .task { await load() }
        }
    }

    private func weekdayRow(_ weekday: Int) -> some View {
        let range = hours[weekday] ?? DayWorkingHours(startSlot: 16, endSlot: 36)
        return VStack(alignment: .leading, spacing: 6) {
            Text(weekdayLabels[weekday])
                .font(.subheadline.weight(.semibold))

            HStack {
                Picker(languageManager.text("From", "С"), selection: startBinding(weekday)) {
                    ForEach(0...43, id: \.self) { slot in
                        Text(slotLabel(slot)).tag(slot)
                    }
                }
                .pickerStyle(.menu)

                Picker(languageManager.text("To", "До"), selection: endBinding(weekday)) {
                    ForEach((range.startSlot + 1)...44, id: \.self) { slot in
                        Text(slotLabel(slot)).tag(slot)
                    }
                }
                .pickerStyle(.menu)
            }
        }
        .padding(.vertical, 2)
    }

    private func startBinding(_ weekday: Int) -> Binding<Int> {
        Binding(
            get: { hours[weekday]?.startSlot ?? 16 },
            set: { newStart in
                var range = hours[weekday] ?? DayWorkingHours(startSlot: 16, endSlot: 36)
                range.startSlot = min(max(newStart, 0), 43)
                if range.endSlot <= range.startSlot {
                    range.endSlot = min(44, range.startSlot + 1)
                }
                hours[weekday] = range
            }
        )
    }

    private func endBinding(_ weekday: Int) -> Binding<Int> {
        Binding(
            get: { max(hours[weekday]?.endSlot ?? 36, (hours[weekday]?.startSlot ?? 16) + 1) },
            set: { newEnd in
                var range = hours[weekday] ?? DayWorkingHours(startSlot: 16, endSlot: 36)
                range.endSlot = min(max(newEnd, range.startSlot + 1), 44)
                hours[weekday] = range
            }
        )
    }

    private func slotLabel(_ slot: Int) -> String {
        let totalMinutes = slot * 30
        return String(format: "%02d:%02d", totalMinutes / 60, totalMinutes % 60)
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            hours = try await repository.fetchBranchWorkingHours(companyId: companyId, branchId: branch.id)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func save() async {
        isSaving = true
        errorMessage = nil
        do {
            hours = try await repository.updateBranchWorkingHours(companyId: companyId, branchId: branch.id, hours: hours)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }
}
