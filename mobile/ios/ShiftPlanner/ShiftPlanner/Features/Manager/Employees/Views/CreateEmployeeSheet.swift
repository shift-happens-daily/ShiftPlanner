import SwiftUI

struct CreateEmployeeSheet: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @Environment(\.dismiss) private var dismiss

    @State private var draft: EmployeeCreationDraft

    let positions: [ManagedPosition]
    let branches: [ManagedBranch]
    let isSubmitting: Bool
    let errorMessage: String?
    let statusMessage: String?
    let onSave: @MainActor (EmployeeCreationDraft) async -> Bool

    init(
        draft: EmployeeCreationDraft,
        positions: [ManagedPosition],
        branches: [ManagedBranch],
        isSubmitting: Bool,
        errorMessage: String?,
        statusMessage: String?,
        onSave: @escaping @MainActor (EmployeeCreationDraft) async -> Bool
    ) {
        _draft = State(initialValue: draft)
        self.positions = positions
        self.branches = branches
        self.isSubmitting = isSubmitting
        self.errorMessage = errorMessage
        self.statusMessage = statusMessage
        self.onSave = onSave
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(languageManager.text("Employee", "Сотрудник")) {
                    TextField(languageManager.text("Full name", "Полное имя"), text: $draft.fullName)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()

                    TextField(languageManager.text("Email", "Email"), text: $draft.email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                Section(languageManager.text("Role setup", "Назначение")) {
                    Picker(languageManager.text("Position", "Должность"), selection: $draft.positionId) {
                        ForEach(positions) { position in
                            Text(position.title).tag(Optional(position.id))
                        }
                    }

                    Picker(languageManager.text("Branch", "Филиал"), selection: $draft.branchId) {
                        Text(languageManager.text("Default branch", "Филиал по умолчанию"))
                            .tag(Optional<Int>.none)
                        ForEach(branches) { branch in
                            Text(branch.name).tag(Optional(branch.id))
                        }
                    }
                }

                if let statusMessage {
                    Section {
                        Text(statusMessage)
                            .font(.footnote)
                            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                    }
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(themeManager.selectedTheme.destructiveColor)
                    }
                }

                Section {
                    Text(
                        languageManager.text(
                            "The employee will be added to the company even if they have not registered yet. They can finish registration later with the same email.",
                            "Сотрудник будет добавлен в компанию, даже если он еще не зарегистрирован. Он сможет завершить регистрацию позже с этим же email."
                        )
                    )
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }
            }
            .navigationTitle(languageManager.text("Add employee", "Добавить сотрудника"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(languageManager.text("Cancel", "Отмена")) {
                        dismiss()
                    }
                    .disabled(isSubmitting)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        submit()
                    } label: {
                        if isSubmitting {
                            ProgressView()
                                .tint(themeManager.selectedTheme.accentColor)
                        } else {
                            Text(languageManager.text("Add", "Добавить"))
                        }
                    }
                    .disabled(isSubmitting || !canSubmit)
                }
            }
        }
        .interactiveDismissDisabled(isSubmitting)
    }

    private func submit() {
        let currentDraft = draft

        Task { @MainActor in
            let didSave = await onSave(currentDraft)
            if didSave {
                dismiss()
            }
        }
    }

    private var canSubmit: Bool {
        !draft.fullName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !draft.email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !positions.isEmpty &&
        draft.positionId != nil
    }
}
