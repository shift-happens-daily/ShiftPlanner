import SwiftUI

struct EmployeeListView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel: EmployeeListViewModel

    @State private var pickerSheet: EmployeePickerSheet? = nil
    @State private var newPositionTitle = ""

    init(user: AppUser) {
        _viewModel = StateObject(
            wrappedValue: EmployeeListViewModel(
                repository: APIEmployeeManagementRepository(companyId: user.company?.id)
            )
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 16) {
                    if viewModel.isLoading && !viewModel.hasEmployees {
                        ProgressView().padding(.top, 40)
                    } else {
                        if viewModel.hasPendingRequests {
                            requestsSection
                        }
                        employeesSection
                        positionsSection
                        messages
                    }
                }
                .padding()
            }
            .background(themeManager.selectedTheme.screenBackground)
            .navigationTitle(languageManager.text("Employees", "Сотрудники"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        pickerSheet = .link
                    } label: {
                        Image(systemName: "person.badge.plus")
                    }
                }
            }
            .refreshable { await viewModel.reload() }
            .task { await viewModel.loadData() }
            .sheet(item: $pickerSheet) { sheet in
                pickerSheetContent(sheet)
                    .environmentObject(themeManager)
                    .environmentObject(languageManager)
            }
        }
    }

    // MARK: - Pending requests

    private var requestsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(languageManager.text("Pending requests", "Заявки на вступление"))
                .font(.headline)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            ForEach(viewModel.managerRequests) { request in
                requestCard(
                    title: request.fullName,
                    subtitle: request.email,
                    badge: languageManager.text("Manager", "Менеджер") + " · \(request.managerRole)",
                    onAccept: { Task { await viewModel.acceptManagerRequest(request) } },
                    onDecline: { Task { await viewModel.declineManagerRequest(request) } }
                )
            }

            ForEach(viewModel.employeeRequests) { request in
                requestCard(
                    title: request.fullName,
                    subtitle: request.email,
                    badge: languageManager.text("Employee", "Сотрудник"),
                    onAccept: { Task { await viewModel.acceptEmployeeRequest(request) } },
                    onDecline: { Task { await viewModel.declineEmployeeRequest(request) } }
                )
            }
        }
    }

    private func requestCard(
        title: String,
        subtitle: String,
        badge: String,
        onAccept: @escaping () -> Void,
        onDecline: @escaping () -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            Text(badge)
                .font(.caption2.weight(.semibold))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(themeManager.selectedTheme.cardTint)
                .clipShape(Capsule())

            HStack(spacing: 10) {
                Button(languageManager.text("Accept", "Принять"), action: onAccept)
                    .buttonStyle(.plain)
                    .themeCompactSecondaryAction()
                Button(languageManager.text("Decline", "Отклонить"), role: .destructive, action: onDecline)
                    .buttonStyle(.plain)
                    .themeCompactDestructiveAction()
                Spacer()
            }
        }
        .padding(16)
        .themeCard()
    }

    // MARK: - Employees

    private var employeesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(languageManager.text("Team", "Команда"))
                .font(.headline)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            if !viewModel.hasEmployees {
                Text(languageManager.text(
                    "No employees yet. Add one by ID or wait for join requests.",
                    "Пока нет сотрудников. Привяжите по ID или дождитесь заявок."
                ))
                .font(.footnote)
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            } else {
                ForEach(viewModel.employees) { employee in
                    ManagedEmployeeCardView(
                        employee: employee,
                        branchTitle: viewModel.branchTitle(for: employee),
                        positionTitle: viewModel.positionTitle(for: employee),
                        isBranchPickerExpanded: false,
                        isRolePickerExpanded: false,
                        canDeleteEmployee: viewModel.capabilities.canRemoveEmployee,
                        onToggleBranchPicker: { pickerSheet = .branch(employee) },
                        onToggleRolePicker: { pickerSheet = .role(employee) },
                        onDelete: { Task { await viewModel.removeEmployee(employee) } },
                        onWorkLimits: { pickerSheet = .workLimits(employee) },
                        onViewCalendar: { pickerSheet = .calendar(employee) }
                    )
                }
            }
        }
    }

    // MARK: - Positions

    private var positionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(languageManager.text("Positions", "Должности"))
                .font(.headline)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            if viewModel.capabilities.canCreatePosition {
                HStack(spacing: 10) {
                    TextField(
                        languageManager.text("New position", "Новая должность"),
                        text: $newPositionTitle
                    )
                    .textFieldStyle(.roundedBorder)

                    Button(languageManager.text("Add", "Добавить")) {
                        let title = newPositionTitle
                        newPositionTitle = ""
                        Task { await viewModel.addPosition(title: title) }
                    }
                    .buttonStyle(.plain)
                    .themeCompactSecondaryAction()
                    .disabled(newPositionTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }

            if !viewModel.hasPositions {
                Text(languageManager.text("No positions yet.", "Должностей пока нет."))
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            } else {
                ForEach(viewModel.positions) { position in
                    ManagedPositionRowView(
                        position: position,
                        onDelete: { Task { await viewModel.removePosition(position) } }
                    )
                }
            }
        }
    }

    @ViewBuilder
    private var messages: some View {
        if let statusMessage = viewModel.statusMessage {
            Text(statusMessage)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        if let errorMessage = viewModel.errorMessage {
            Text(errorMessage)
                .font(.footnote)
                .foregroundStyle(.red)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - Picker sheets

    @ViewBuilder
    private func pickerSheetContent(_ sheet: EmployeePickerSheet) -> some View {
        switch sheet {
        case let .branch(employee):
            NavigationStack {
                ScrollView {
                    BranchPickerListView(
                        branches: viewModel.branches,
                        currentBranchTitle: viewModel.branchTitle(for: employee),
                        onAssignBranch: { branchId in
                            Task { await viewModel.assignBranch(branchId, to: employee) }
                            pickerSheet = nil
                        }
                    )
                }
                .background(themeManager.selectedTheme.screenBackground)
                .navigationTitle(languageManager.text("Branch", "Филиал"))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button(languageManager.text("Cancel", "Отмена")) { pickerSheet = nil }
                    }
                }
            }
        case let .role(employee):
            NavigationStack {
                ScrollView {
                    PositionPickerListView(
                        positions: viewModel.positions,
                        currentPositionTitle: viewModel.positionTitle(for: employee),
                        canAssignPosition: viewModel.capabilities.canAssignPosition,
                        canDeletePosition: viewModel.capabilities.canRemovePosition,
                        onAssignPosition: { positionId in
                            Task { await viewModel.assignPosition(positionId, to: employee) }
                            pickerSheet = nil
                        },
                        onCreatePosition: { title in
                            Task { await viewModel.addPosition(title: title, assigningTo: employee) }
                            pickerSheet = nil
                        },
                        onDeletePosition: { position in
                            Task { await viewModel.removePosition(position) }
                        }
                    )
                }
                .background(themeManager.selectedTheme.screenBackground)
                .navigationTitle(languageManager.text("Position", "Должность"))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button(languageManager.text("Cancel", "Отмена")) { pickerSheet = nil }
                    }
                }
            }
        case let .workLimits(employee):
            WorkLimitsSheet(
                viewModel: viewModel,
                employee: employee,
                onClose: { pickerSheet = nil }
            )
        case let .calendar(employee):
            EmployeeCalendarSheet(
                viewModel: viewModel,
                employee: employee,
                onClose: { pickerSheet = nil }
            )
        case .link:
            LinkEmployeeSheet(
                viewModel: viewModel,
                onClose: { pickerSheet = nil }
            )
        }
    }
}

// MARK: - Employee calendar sheet

private struct EmployeeCalendarSheet: View {
    @EnvironmentObject private var languageManager: LanguageManager
    @EnvironmentObject private var themeManager: ThemeManager
    @ObservedObject var viewModel: EmployeeListViewModel
    let employee: ManagedEmployee
    let onClose: () -> Void

    @State private var summary: EmployeeCalendarSummary?
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let summary, !summary.shifts.isEmpty {
                    List {
                        Section {
                            HStack {
                                stat(value: "\(summary.totalShifts)", label: languageManager.text("Shifts", "Смены"))
                                stat(value: String(format: "%.1f", summary.totalHours), label: languageManager.text("Hours", "Часы"))
                            }
                        }
                        Section(languageManager.text("Shifts", "Смены")) {
                            ForEach(summary.shifts) { shift in
                                HStack {
                                    Text(Self.dateLabel(shift.date, locale: languageManager.locale))
                                        .font(.subheadline)
                                    Spacer()
                                    Text("\(Self.time(shift.startMinutes)) – \(Self.time(shift.endMinutes))")
                                        .font(.subheadline.monospacedDigit())
                                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                                }
                            }
                        }
                    }
                } else {
                    Text(languageManager.text("No shifts scheduled.", "Смен не запланировано."))
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationTitle(employee.fullName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(languageManager.text("Close", "Закрыть")) { onClose() }
                }
            }
            .task {
                summary = await viewModel.employeeCalendar(for: employee.id)
                isLoading = false
            }
        }
    }

    private func stat(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title3.bold())
                .foregroundStyle(themeManager.selectedTheme.accentColor)
            Text(label)
                .font(.caption)
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
        }
        .frame(maxWidth: .infinity)
    }

    private static func time(_ minutes: Int) -> String {
        String(format: "%02d:%02d", minutes / 60, minutes % 60)
    }

    private static func dateLabel(_ date: Date, locale: Locale) -> String {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.dateFormat = "EEE d MMM"
        return formatter.string(from: date)
    }
}

// MARK: - Work limits sheet

private struct WorkLimitsSheet: View {
    @EnvironmentObject private var languageManager: LanguageManager
    @ObservedObject var viewModel: EmployeeListViewModel
    let employee: ManagedEmployee
    let onClose: () -> Void

    @State private var maxPerDay = 8
    @State private var maxPerWeek = 40
    @State private var isLoading = true
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                if isLoading {
                    ProgressView()
                } else {
                    Section(employee.fullName) {
                        Stepper(value: $maxPerDay, in: 1...24) {
                            Text(languageManager.text("Max hours / day", "Часов в день") + ": \(maxPerDay)")
                        }
                        Stepper(value: $maxPerWeek, in: 1...168) {
                            Text(languageManager.text("Max hours / week", "Часов в неделю") + ": \(maxPerWeek)")
                        }
                    }

                    Section {
                        Button {
                            Task {
                                isSaving = true
                                await viewModel.updateWorkLimits(
                                    employeeId: employee.id,
                                    maxHoursPerWeek: maxPerWeek,
                                    maxHoursPerDay: maxPerDay
                                )
                                isSaving = false
                                onClose()
                            }
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
            }
            .navigationTitle(languageManager.text("Work limits", "Лимиты работы"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(languageManager.text("Cancel", "Отмена")) { onClose() }
                }
            }
            .task {
                if let limits = await viewModel.workLimits(for: employee.id) {
                    maxPerDay = limits.maxHoursPerDay
                    maxPerWeek = limits.maxHoursPerWeek
                }
                isLoading = false
            }
        }
    }
}

// MARK: - Link employee sheet

private struct LinkEmployeeSheet: View {
    @EnvironmentObject private var languageManager: LanguageManager
    @ObservedObject var viewModel: EmployeeListViewModel
    let onClose: () -> Void

    @State private var publicId = ""
    @State private var branchId: Int? = nil
    @State private var positionId: Int? = nil
    @State private var isLinking = false

    var body: some View {
        NavigationStack {
            Form {
                Section(languageManager.text("Employee ID", "ID сотрудника")) {
                    TextField(
                        languageManager.text("16-character ID", "16-символьный ID"),
                        text: $publicId
                    )
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                }

                Section(languageManager.text("Branch (optional)", "Филиал (необязательно)")) {
                    Picker(languageManager.text("Branch", "Филиал"), selection: $branchId) {
                        Text(languageManager.text("None", "Без филиала")).tag(Int?.none)
                        ForEach(viewModel.branches) { branch in
                            Text(branch.name).tag(Int?.some(branch.id))
                        }
                    }
                }

                Section(languageManager.text("Position (optional)", "Должность (необязательно)")) {
                    Picker(languageManager.text("Position", "Должность"), selection: $positionId) {
                        Text(languageManager.text("None", "Без должности")).tag(Int?.none)
                        ForEach(viewModel.positions) { position in
                            Text(position.title).tag(Int?.some(position.id))
                        }
                    }
                }

                Section {
                    Button {
                        Task {
                            isLinking = true
                            await viewModel.linkEmployee(publicId: publicId, branchId: branchId, positionId: positionId)
                            isLinking = false
                            if viewModel.errorMessage == nil {
                                onClose()
                            }
                        }
                    } label: {
                        if isLinking {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text(languageManager.text("Link employee", "Привязать сотрудника")).frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(isLinking || publicId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .navigationTitle(languageManager.text("Link by ID", "Привязка по ID"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(languageManager.text("Cancel", "Отмена")) { onClose() }
                }
            }
        }
    }
}

private enum EmployeePickerSheet: Identifiable {
    case branch(ManagedEmployee)
    case role(ManagedEmployee)
    case workLimits(ManagedEmployee)
    case calendar(ManagedEmployee)
    case link

    var id: String {
        switch self {
        case let .branch(employee): return "branch-\(employee.id)"
        case let .role(employee): return "role-\(employee.id)"
        case let .workLimits(employee): return "limits-\(employee.id)"
        case let .calendar(employee): return "calendar-\(employee.id)"
        case .link: return "link"
        }
    }
}
