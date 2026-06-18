
import SwiftUI

struct EmployeeListView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel: EmployeeListViewModel
    @State private var employeePendingRemoval: ManagedEmployee?
    @State private var positionPendingRemoval: ManagedPosition?
    @State private var employeeRolePickerTarget: ManagedEmployee?

    let user: AppUser
    let onUserUpdated: (AppUser) -> Void

    @MainActor
    init(
        user: AppUser,
        onUserUpdated: @escaping (AppUser) -> Void,
        repository: EmployeeManagementRepository? = nil
    ) {
        self.user = user
        self.onUserUpdated = onUserUpdated
        _viewModel = StateObject(wrappedValue: EmployeeListViewModel(repository: repository))
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                if user.hasCompany {
                    VStack(alignment: .leading, spacing: 18) {
                        Text(languageManager.text("Local preview mode: employee and role changes are stored only in the app UI for now.", "Режим локального предпросмотра: изменения сотрудников и ролей пока сохраняются только в интерфейсе приложения."))
                            .font(.footnote)
                            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                        VStack(alignment: .leading, spacing: 14) {
                            Text(languageManager.text("Employees", "Сотрудники"))
                                .font(.title3)
                                .fontWeight(.bold)
                                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                            if viewModel.isLoading {
                                HStack {
                                    Spacer()
                                    ProgressView(languageManager.text("Loading preview data...", "Загрузка предпросмотра..."))
                                    Spacer()
                                }
                                .padding(.vertical, 20)
                            } else if viewModel.hasEmployees {
                                VStack(spacing: 12) {
                                    ForEach(viewModel.employees) { employee in
                                        ManagedEmployeeCardView(
                                            employee: employee,
                                            positionTitle: viewModel.positionTitle(for: employee),
                                            onOpenRolePicker: {
                                                employeeRolePickerTarget = employee
                                            },
                                            onDelete: {
                                                employeePendingRemoval = employee
                                            }
                                        )
                                    }
                                }
                            } else {
                                Text(languageManager.text("No employees have joined the company yet.", "К компании пока не присоединился ни один сотрудник."))
                                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                                    .padding(18)
                                    .themeCard()
                            }
                        }

                        if let statusMessage = viewModel.statusMessage {
                            Text(statusMessage)
                                .font(.footnote)
                                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        }

                        if let errorMessage = viewModel.errorMessage {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundStyle(themeManager.selectedTheme.destructiveColor)
                        }
                    }
                    .padding()
                } else {
                    ManagerCompanyAccessContentView(user: user, onUserUpdated: onUserUpdated)
                        .padding()
                }
            }
            .background(themeManager.selectedTheme.screenBackground)
            .navigationTitle(languageManager.text("Employees", "Сотрудники"))
            .navigationBarTitleDisplayMode(.inline)
            .alert(languageManager.text("Remove employee?", "Удалить сотрудника?"), isPresented: employeeRemovalBinding) {
                Button(languageManager.text("Cancel", "Отмена"), role: .cancel) {}
                Button(languageManager.text("Remove", "Удалить"), role: .destructive) {
                    if let employeePendingRemoval {
                        Task {
                            await viewModel.removeEmployee(employeePendingRemoval)
                        }
                    }
                    employeePendingRemoval = nil
                }
            } message: {
                Text(languageManager.text("This employee will be removed from the local company preview.", "Этот сотрудник будет удален из локального предпросмотра компании."))
            }
            .alert(languageManager.text("Delete role?", "Удалить должность?"), isPresented: positionRemovalBinding) {
                Button(languageManager.text("Cancel", "Отмена"), role: .cancel) {}
                Button(languageManager.text("Delete", "Удалить"), role: .destructive) {
                    if let positionPendingRemoval {
                        Task {
                            await viewModel.removePosition(positionPendingRemoval)
                        }
                    }
                    positionPendingRemoval = nil
                }
            } message: {
                Text(languageManager.text("Employees with this role will become unassigned in the local preview.", "Сотрудники с этой должностью станут без роли в локальном предпросмотре."))
            }
            .sheet(item: $employeeRolePickerTarget) { employee in
                EmployeeRolePickerSheet(
                    employee: employee,
                    positions: viewModel.positions,
                    currentPositionTitle: viewModel.positionTitle(for: employee),
                    onAssignPosition: { positionId in
                        Task {
                            await viewModel.assignPosition(positionId, to: employee)
                        }
                    },
                    onCreatePosition: { title in
                        Task {
                            await viewModel.addPosition(title: title, assigningTo: employee)
                        }
                    },
                    onDeletePosition: { position in
                        positionPendingRemoval = position
                    }
                )
            }
            .task {
                if user.hasCompany {
                    await viewModel.loadData()
                }
            }
        }
    }

    private var employeeRemovalBinding: Binding<Bool> {
        Binding(
            get: { employeePendingRemoval != nil },
            set: { isPresented in
                if !isPresented {
                    employeePendingRemoval = nil
                }
            }
        )
    }

    private var positionRemovalBinding: Binding<Bool> {
        Binding(
            get: { positionPendingRemoval != nil },
            set: { isPresented in
                if !isPresented {
                    positionPendingRemoval = nil
                }
            }
        )
    }
}
