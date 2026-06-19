
import SwiftUI

private struct EmployeeCardBoundsPreferenceKey: PreferenceKey {
    static var defaultValue: [Int: Anchor<CGRect>] = [:]

    static func reduce(value: inout [Int: Anchor<CGRect>], nextValue: () -> [Int: Anchor<CGRect>]) {
        value.merge(nextValue(), uniquingKeysWith: { _, new in new })
    }
}

struct EmployeeListView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel: EmployeeListViewModel
    @State private var employeePendingRemoval: ManagedEmployee?
    @State private var positionPendingRemoval: ManagedPosition?
    @State private var expandedEmployeeId: Int?

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
            ZStack(alignment: .topLeading) {
                ScrollView(showsIndicators: false) {
                    if user.hasCompany {
                        companyEmployeesContent
                        .padding()
                    } else {
                        ManagerCompanyAccessContentView(user: user, onUserUpdated: onUserUpdated)
                            .padding()
                    }
                }
            }
            .overlayPreferenceValue(EmployeeCardBoundsPreferenceKey.self) { anchors in
                employeePickerOverlay(anchors: anchors)
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
            positionTitle: viewModel.positionTitle(for: employee),
            isPickerExpanded: expandedEmployeeId == employee.id,
            canDeleteEmployee: viewModel.capabilities.canRemoveEmployee,
            onToggleRolePicker: {
                expandedEmployeeId = expandedEmployeeId == employee.id ? nil : employee.id
            },
            onDelete: {
                employeePendingRemoval = employee
            }
        )
        .anchorPreference(
            key: EmployeeCardBoundsPreferenceKey.self,
            value: .bounds
        ) { [employee.id: $0] }
        .zIndex(expandedEmployeeId == employee.id ? 1000 : Double(viewModel.employees.count - index))
    }

    @ViewBuilder
    private func employeePickerOverlay(anchors: [Int: Anchor<CGRect>]) -> some View {
        GeometryReader { proxy in
            if let pickerData = expandedPickerData(anchors: anchors, proxy: proxy) {
                PositionPickerListView(
                    positions: viewModel.positions,
                    currentPositionTitle: pickerData.positionTitle,
                    canAssignPosition: viewModel.capabilities.canAssignPosition,
                    canDeletePosition: viewModel.capabilities.canRemovePosition,
                    onAssignPosition: { positionId in
                        Task {
                            await viewModel.assignPosition(positionId, to: pickerData.employee)
                            expandedEmployeeId = nil
                        }
                    },
                    onCreatePosition: { title in
                        Task {
                            await viewModel.addPosition(title: title, assigningTo: pickerData.employee)
                            expandedEmployeeId = nil
                        }
                    },
                    onDeletePosition: { position in
                        positionPendingRemoval = position
                        expandedEmployeeId = nil
                    }
                )
                .frame(width: 260)
                .offset(x: pickerData.frame.maxX - 268, y: pickerData.frame.minY + 46)
                .zIndex(2000)
            }
        }
        .allowsHitTesting(expandedEmployeeId != nil)
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
            viewModel.capabilities.canRemoveEmployee &&
            viewModel.capabilities.canRemovePosition {
            return languageManager.text("Employee data is synced with the backend.", "Данные сотрудников синхронизируются с бэкендом.")
        }

        return languageManager.text(
            "Employee and role lists are loaded from the backend. Position creation works via API, while reassignment and deletion are waiting for backend support.",
            "Списки сотрудников и должностей загружаются с бэкенда. Создание должности уже работает через API, а переназначение и удаление ждут поддержки на бэкенде."
        )
    }

    private func expandedPickerData(
        anchors: [Int: Anchor<CGRect>],
        proxy: GeometryProxy
    ) -> (employee: ManagedEmployee, positionTitle: String, frame: CGRect)? {
        guard let expandedEmployeeId,
              let anchor = anchors[expandedEmployeeId],
              let employee = viewModel.employees.first(where: { $0.id == expandedEmployeeId }) else {
            return nil
        }

        return (
            employee: employee,
            positionTitle: viewModel.positionTitle(for: employee),
            frame: proxy[anchor]
        )
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
