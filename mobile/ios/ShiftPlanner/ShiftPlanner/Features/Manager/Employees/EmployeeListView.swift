
import SwiftUI

struct EmployeeListView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel: EmployeeListViewModel
    @State private var employeePendingRemoval: ManagedEmployee?
    @State private var positionPendingRemoval: ManagedPosition?
    @State private var branchPickerEmployee: ManagedEmployee?
    @State private var rolePickerEmployee: ManagedEmployee?

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
        _viewModel = StateObject(
            wrappedValue: EmployeeListViewModel(
                repository: repository ?? APIEmployeeManagementRepository(companyId: user.company?.id)
            )
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                if user.hasCompany {
                    companyEmployeesContent
                    .padding()
                } else {
                    ManagerCompanyAccessContentView(user: user, onUserUpdated: onUserUpdated)
                        .padding()
                }
            }
            .background(themeManager.selectedTheme.screenBackground)
            .navigationTitle(languageManager.text("Employees", "Сотрудники"))
            .navigationBarTitleDisplayMode(.inline)
            .sheet(item: $branchPickerEmployee) { employee in
                branchPickerSheet(for: employee)
            }
            .sheet(item: $rolePickerEmployee) { employee in
                rolePickerSheet(for: employee)
            }
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
                Text(
                    languageManager.text(
                        "The position will be removed from the backend. If it is still used by employees, requirements, or shifts, the server will reject deletion.",
                        "Должность будет удалена на бэкенде. Если она все еще используется сотрудниками, требованиями или сменами, сервер не даст ее удалить."
                    )
                )
            }
            .task {
                if user.hasCompany {
                    await viewModel.loadData()
                }
            }
        }
    }

    @ViewBuilder
    private var companyEmployeesContent: some View {
        VStack(alignment: .leading, spacing: 18) {
            syncInfoText
            employeesSection
            statusSection
        }
    }

    private var syncInfoText: some View {
        Text(syncInfoMessage)
            .font(.footnote)
            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
    }

    @ViewBuilder
    private var employeesSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(languageManager.text("Employees", "Сотрудники"))
                .font(.title3)
                .fontWeight(.bold)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            if viewModel.isLoading {
                loadingView
            } else if viewModel.hasEmployees {
                employeeCardsList
            } else {
                emptyEmployeesView
            }
        }
    }

    private var loadingView: some View {
        HStack {
            Spacer()
            ProgressView(languageManager.text("Loading preview data...", "Загрузка предпросмотра..."))
            Spacer()
        }
        .padding(.vertical, 20)
    }

    private var employeeCardsList: some View {
        VStack(spacing: 12) {
            ForEach(Array(viewModel.employees.enumerated()), id: \.element.id) { index, employee in
                employeeCard(employee, index: index)
            }
        }
    }

    private func employeeCard(_ employee: ManagedEmployee, index: Int) -> some View {
        ManagedEmployeeCardView(
            employee: employee,
            branchTitle: viewModel.branchTitle(for: employee),
            positionTitle: viewModel.positionTitle(for: employee),
            isBranchPickerExpanded: branchPickerEmployee?.id == employee.id,
            isRolePickerExpanded: rolePickerEmployee?.id == employee.id,
            canDeleteEmployee: true,
            onToggleBranchPicker: {
                branchPickerEmployee = employee
            },
            onToggleRolePicker: {
                rolePickerEmployee = employee
            },
            onDelete: {
                employeePendingRemoval = employee
            }
        )
        .zIndex(rolePickerEmployee?.id == employee.id ? 1000 : Double(viewModel.employees.count - index))
    }

    private var emptyEmployeesView: some View {
        Text(languageManager.text("No employees have joined the company yet.", "К компании пока не присоединился ни один сотрудник."))
            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            .padding(18)
            .themeCard()
    }

    @ViewBuilder
    private var statusSection: some View {
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

    private var syncInfoMessage: String {
        if viewModel.capabilities.canAssignPosition &&
            viewModel.capabilities.canRemovePosition {
            return languageManager.text(
                "Roles and positions are synced with the backend. Employee removal is still local-only for now.",
                "Роли и должности синхронизируются с бэкендом. Удаление сотрудника пока работает только локально."
            )
        }

        return languageManager.text(
            "Employee, branch, and role lists are loaded from the backend. Some management actions may still work only locally.",
            "Списки сотрудников, филиалов и должностей загружаются с бэкенда. Часть действий управления пока может работать только локально."
        )
    }

    private func branchPickerSheet(for employee: ManagedEmployee) -> some View {
        NavigationStack {
            VStack(spacing: 0) {
                BranchPickerListView(
                    branches: viewModel.branches,
                    currentBranchTitle: viewModel.branchTitle(for: employee),
                    onAssignBranch: { branchId in
                        Task {
                            await viewModel.assignBranch(branchId, to: employee)
                            branchPickerEmployee = nil
                        }
                    }
                )
                .padding()

                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(themeManager.selectedTheme.screenBackground)
            .navigationTitle(languageManager.text("Branch", "Филиал"))
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func rolePickerSheet(for employee: ManagedEmployee) -> some View {
        NavigationStack {
            VStack(spacing: 0) {
                PositionPickerListView(
                    positions: viewModel.positions,
                    currentPositionTitle: viewModel.positionTitle(for: employee),
                    canAssignPosition: viewModel.capabilities.canAssignPosition,
                    canDeletePosition: viewModel.capabilities.canRemovePosition,
                    onAssignPosition: { positionId in
                        Task {
                            await viewModel.assignPosition(positionId, to: employee)
                            rolePickerEmployee = nil
                        }
                    },
                    onCreatePosition: { title in
                        Task {
                            await viewModel.addPosition(title: title, assigningTo: employee)
                            rolePickerEmployee = nil
                        }
                    },
                    onDeletePosition: { position in
                        positionPendingRemoval = position
                        rolePickerEmployee = nil
                    }
                )
                .padding()

                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(themeManager.selectedTheme.screenBackground)
            .navigationTitle(languageManager.text("Position", "Должность"))
            .navigationBarTitleDisplayMode(.inline)
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
