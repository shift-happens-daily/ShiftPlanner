
import SwiftUI

struct EmployeeListView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel: EmployeeListViewModel
    @State private var employeePendingRemoval: ManagedEmployee?
    @State private var positionPendingRemoval: ManagedPosition?
    @State private var activeSheet: EmployeeListActiveSheet?

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
            .sheet(item: $activeSheet) { sheet in
                switch sheet {
                case .branch(let employee):
                    branchPickerSheet(for: employee)
                case .position(let employee):
                    rolePickerSheet(for: employee)
                case .create:
                    createEmployeeSheet
                }
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
                Text(languageManager.text("This employee will be removed from the company.", "Этот сотрудник будет удален из компании."))
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
            .onAppear {
                guard user.hasCompany else { return }
                Task {
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
            HStack(alignment: .center, spacing: 12) {
                Text(languageManager.text("Employees", "Сотрудники"))
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                Spacer()

                Button {
                    activeSheet = .create
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                            .font(.caption)
                        Text(languageManager.text("Add", "Добавить"))
                            .font(.caption)
                            .fontWeight(.semibold)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(themeManager.selectedTheme.elevatedSurfaceColor)
                    .overlay {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                .disabled(!viewModel.canCreateEmployee)
                .opacity(viewModel.canCreateEmployee ? 1 : 0.5)
            }

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
            isBranchPickerExpanded: activeSheet?.employee?.id == employee.id && activeSheet?.kind == .branch,
            isRolePickerExpanded: activeSheet?.employee?.id == employee.id && activeSheet?.kind == .position,
            canDeleteEmployee: viewModel.capabilities.canRemoveEmployee,
            onToggleBranchPicker: {
                activeSheet = .branch(employee)
            },
            onToggleRolePicker: {
                activeSheet = .position(employee)
            },
            onDelete: {
                employeePendingRemoval = employee
            }
        )
        .zIndex(activeSheet?.employee?.id == employee.id ? 1000 : Double(viewModel.employees.count - index))
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
                "Managers can add employees before registration. Roles, positions, and employee removal are synced with the backend.",
                "Менеджер может добавлять сотрудников до регистрации. Роли, должности и удаление сотрудников синхронизируются с бэкендом."
            )
        }

        return languageManager.text(
            "Employee, branch, and role lists are loaded from the backend. Managers can also add employees before they register.",
            "Списки сотрудников, филиалов и должностей загружаются с бэкенда. Менеджер также может добавить сотрудника еще до его регистрации."
        )
    }

    private var createEmployeeSheet: some View {
        CreateEmployeeSheet(
            draft: viewModel.makeEmployeeDraft(),
            positions: viewModel.positions,
            branches: viewModel.branches,
            isSubmitting: viewModel.isCreatingEmployee,
            errorMessage: viewModel.errorMessage,
            statusMessage: viewModel.statusMessage,
            onSave: { draft in
                await viewModel.createEmployee(from: draft)
            }
        )
        .presentationDetents([.medium, .large])
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
                            activeSheet = nil
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
                            activeSheet = nil
                        }
                    },
                    onCreatePosition: { title in
                        Task {
                            await viewModel.addPosition(title: title, assigningTo: employee)
                            activeSheet = nil
                        }
                    },
                    onDeletePosition: { position in
                        positionPendingRemoval = position
                        activeSheet = nil
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

private enum EmployeeListSheetKind {
    case branch
    case position
    case create
}

private enum EmployeeListActiveSheet: Identifiable {
    case branch(ManagedEmployee)
    case position(ManagedEmployee)
    case create

    var id: String {
        switch self {
        case .branch(let employee):
            return "branch-\(employee.id)"
        case .position(let employee):
            return "position-\(employee.id)"
        case .create:
            return "create"
        }
    }

    var kind: EmployeeListSheetKind {
        switch self {
        case .branch:
            return .branch
        case .position:
            return .position
        case .create:
            return .create
        }
    }

    var employee: ManagedEmployee? {
        switch self {
        case .branch(let employee), .position(let employee):
            return employee
        case .create:
            return nil
        }
    }
}
