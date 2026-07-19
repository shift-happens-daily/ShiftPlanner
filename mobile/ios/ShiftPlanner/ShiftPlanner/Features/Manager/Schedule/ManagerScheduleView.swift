import SwiftUI
import CoreTransferable
import UniformTypeIdentifiers

/// Lazily writes the schedule CSV to a temp file only when the user
/// actually shares it.
struct ScheduleCSVExport: Transferable {
    let csv: String
    let fileName: String

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .commaSeparatedText) { export in
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent(export.fileName)
            try export.csv.data(using: .utf8)?.write(to: url, options: .atomic)
            return SentTransferredFile(url)
        }
    }
}

struct ManagerScheduleView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager

    @StateObject private var viewModel: ManagerScheduleViewModel

    @State private var activeSheet: ScheduleSheet? = nil
    @State private var showPublishConfirm = false
    @State private var showDeleteConfirm = false
    @State private var showDeleteWeekConfirm = false
    @State private var presentationMode: SchedulePresentationMode = .list

    init(user: AppUser) {
        _viewModel = StateObject(wrappedValue: ManagerScheduleViewModel(user: user))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if viewModel.isLoading && !viewModel.hasSchedule {
                        weekHeader
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding(.top, 40)
                    } else if viewModel.hasSchedule {
                        modePicker
                        scheduleSummary

                        if presentationMode == .list {
                            weekHeader
                            filterPicker
                            ForEach(viewModel.weekDates, id: \.self) { day in
                                dayCard(day)
                            }
                        } else {
                            filterPicker
                            ScheduleCalendarSectionView(
                                items: viewModel.calendarEntries,
                                sectionTitle: languageManager.text("Shifts", "Смены"),
                                dateProvider: { $0.date },
                                rowContent: { entry -> AnyView in
                                    switch entry {
                                    case .shift(let shift):
                                        return AnyView(shiftRow(shift))
                                    case .unfilled(let requirement, _):
                                        return AnyView(unfilledRow(requirement))
                                    }
                                },
                                filledProvider: { $0.isFilled }
                            )
                        }

                        actionButtons
                    } else {
                        weekHeader
                        emptyState
                    }
                }
                .padding(16)
            }
            .background(themeManager.selectedTheme.screenBackground.ignoresSafeArea())
            .navigationTitle(languageManager.text("Schedule", "Расписание"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await viewModel.refresh() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(viewModel.isLoading)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    ShareLink(
                        item: ScheduleCSVExport(
                            csv: viewModel.buildScheduleCsv(),
                            fileName: "schedule-\(viewModel.schedule?.id ?? 0).csv"
                        ),
                        preview: SharePreview("schedule-\(viewModel.schedule?.id ?? 0).csv")
                    ) {
                        Image(systemName: "square.and.arrow.up")
                    }
                    .disabled(!viewModel.hasSchedule)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if viewModel.canDeleteWeek {
                            Button(role: .destructive) {
                                showDeleteWeekConfirm = true
                            } label: {
                                Label(languageManager.text("Delete this week", "Удалить эту неделю"), systemImage: "calendar.badge.minus")
                            }
                        }
                        Button(role: .destructive) {
                            showDeleteConfirm = true
                        } label: {
                            Label(languageManager.text("Delete entire schedule", "Удалить всё расписание"), systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "trash")
                    }
                    .disabled(!viewModel.hasSchedule)
                    .alert(
                        languageManager.text("Delete schedule?", "Удалить расписание?"),
                        isPresented: $showDeleteConfirm
                    ) {
                        Button(languageManager.text("Delete", "Удалить"), role: .destructive) {
                            Task { await viewModel.deleteSchedule() }
                        }
                        Button(languageManager.text("Cancel", "Отмена"), role: .cancel) {}
                    } message: {
                        Text(languageManager.text(
                            "This removes the whole schedule for the period.",
                            "Это удалит всё расписание за период."
                        ))
                    }
                    .alert(
                        languageManager.text("Delete this week?", "Удалить эту неделю?"),
                        isPresented: $showDeleteWeekConfirm
                    ) {
                        Button(languageManager.text("Delete", "Удалить"), role: .destructive) {
                            Task { await viewModel.deleteScheduleWeek() }
                        }
                        Button(languageManager.text("Cancel", "Отмена"), role: .cancel) {}
                    } message: {
                        Text(languageManager.text(
                            "This removes only the shifts for the selected week.",
                            "Будут удалены только смены за выбранную неделю."
                        ))
                    }
                }
            }
        }
        .task { await viewModel.loadIfNeeded() }
        .sheet(item: $activeSheet) { sheet in
            sheetContent(sheet)
                .environmentObject(themeManager)
                .environmentObject(languageManager)
        }
        .confirmationDialog(
            languageManager.text("A schedule already exists for this period", "На этот период уже есть расписание"),
            isPresented: conflictBinding,
            titleVisibility: .visible,
            presenting: viewModel.conflict
        ) { conflict in
            Button(languageManager.text("Open existing", "Открыть существующее")) {
                Task { await viewModel.openConflictingSchedule() }
            }
            Button(languageManager.text("Delete and recreate", "Удалить и создать заново"), role: .destructive) {
                Task { await viewModel.deleteConflictingAndRegenerate() }
            }
            Button(languageManager.text("Cancel", "Отмена"), role: .cancel) {
                viewModel.dismissConflict()
            }
        } message: { conflict in
            Text(conflictMessage(conflict))
        }
        .alert(
            languageManager.text("Error", "Ошибка"),
            isPresented: errorBinding
        ) {
            Button("OK", role: .cancel) { viewModel.clearMessages() }
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
    }

    // MARK: - Header

    private var weekHeader: some View {
        HStack {
            Button { viewModel.previousWeek() } label: {
                Image(systemName: "chevron.left")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(themeManager.selectedTheme.accentColor)
                    .frame(width: 34, height: 34)
                    .background(themeManager.selectedTheme.cardTint)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)

            Spacer()

            VStack(spacing: 2) {
                Text(languageManager.text("Week", "Неделя"))
                    .font(.caption)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                Text(viewModel.weekLabel)
                    .font(.headline)
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
            }

            Spacer()

            Button { viewModel.nextWeek() } label: {
                Image(systemName: "chevron.right")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(themeManager.selectedTheme.accentColor)
                    .frame(width: 34, height: 34)
                    .background(themeManager.selectedTheme.cardTint)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .themeCard()
    }

    private var modePicker: some View {
        ThemedSegmentedPicker(selection: $presentationMode, segments: [
            ThemedSegment(.list, languageManager.text("List", "Список")),
            ThemedSegment(.calendar, languageManager.text("Calendar", "Календарь"))
        ])
    }

    private var filterPicker: some View {
        ThemedSegmentedPicker(
            selection: $viewModel.filter,
            segments: ScheduleShiftFilter.allCases.map { ThemedSegment($0, $0.title) }
        )
    }

    /// Header card: schedule title + a prominent Publish button (mirrors
    /// Android, where publishing lives in the screen header). Confirms first
    /// when unfilled shifts remain.
    private var scheduleSummary: some View {
        HStack(spacing: 12) {
            Text(viewModel.scheduleTitle)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            Spacer()

            if viewModel.canPublish {
                Button {
                    if viewModel.schedule?.hasUnfilled == true {
                        showPublishConfirm = true
                    } else {
                        Task { await viewModel.publish() }
                    }
                } label: {
                    if viewModel.isPublishing {
                        ProgressView()
                    } else {
                        Text(languageManager.text("Publish", "Опубликовать"))
                            .font(.subheadline.weight(.semibold))
                    }
                }
                .buttonStyle(.plain)
                .themeCompactSecondaryAction()
                .disabled(viewModel.isPublishing)
                .alert(
                    languageManager.text("Unfilled shifts", "Незаполненные смены"),
                    isPresented: $showPublishConfirm
                ) {
                    Button(languageManager.text("Publish", "Опубликовать")) {
                        Task { await viewModel.publish() }
                    }
                    Button(languageManager.text("Cancel", "Отмена"), role: .cancel) {}
                } message: {
                    Text(languageManager.text(
                        "There are unfilled shifts. Publish the schedule anyway?",
                        "Есть незаполненные смены. Всё ещё хотите опубликовать расписание?"
                    ))
                }
            } else if viewModel.schedule?.status == .published {
                Text(languageManager.text("PUBLISHED", "ОПУБЛИКОВАНО"))
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.green.opacity(0.15))
                    .foregroundStyle(.green)
                    .clipShape(Capsule())
            }
        }
        .padding(16)
        .themeCard()
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 16) {
            Text(languageManager.text(
                "No schedule for this week yet.",
                "На этой неделе ещё нет расписания."
            ))
            .font(.subheadline)
            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            .multilineTextAlignment(.center)

            Button {
                activeSheet = .generate
            } label: {
                Text(languageManager.text("Generate schedule", "Сгенерировать расписание"))
            }
            .buttonStyle(.plain)
            .themePrimaryAction(isEnabled: viewModel.canGenerate)
            .disabled(!viewModel.canGenerate)

            if viewModel.isGenerating {
                ProgressView()
            }

            if let status = viewModel.statusMessage {
                Text(status)
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .themeCard()
    }

    // MARK: - Day card

    private func dayCard(_ day: Date) -> some View {
        let shifts = viewModel.shifts(on: day)
        let unfilled = viewModel.unfilled(on: day)
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(dayTitle(day))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                Spacer()
                Button {
                    activeSheet = .editShift(nil, day)
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(themeManager.selectedTheme.accentColor)
                }
                .buttonStyle(.plain)
            }

            if shifts.isEmpty && unfilled.isEmpty {
                Text(languageManager.text("No shifts", "Нет смен"))
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            } else {
                // Shifts have unique backend ids; unfilled requirements DON'T —
                // the backend repeats requirement_id (one row per missing slot),
                // and duplicate identities inside ForEach send SwiftUI's render
                // graph into "undefined results" (freezes on tab switches).
                // Identify rows by their position in the day's list instead.
                ForEach(shifts) { shift in
                    shiftRow(shift)
                }
                ForEach(Array(unfilled.enumerated()), id: \.offset) { _, requirement in
                    unfilledRow(requirement)
                }
            }
        }
        .padding(16)
        .themeCard()
    }

    private func shiftRow(_ shift: AppScheduledShift) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(ManagerScheduleViewModel.minutesToDisplay(shift.startMinutes)) – \(ManagerScheduleViewModel.minutesToDisplay(shift.endMinutes))")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                Text(shift.positionName)
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                if let name = shift.employeeName, shift.hasAssignedEmployee {
                    Text(name)
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(themeManager.selectedTheme.accentColor)
                } else {
                    Text(languageManager.text("Unassigned", "Не назначен"))
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(.orange)
                }
            }
            Spacer()
            Menu {
                if !shift.hasAssignedEmployee {
                    Button(languageManager.text("Assign employee", "Назначить сотрудника")) {
                        activeSheet = .assignShift(shift)
                    }
                } else {
                    Button(languageManager.text("Reassign", "Переназначить")) {
                        activeSheet = .assignShift(shift)
                    }
                }
                Button(languageManager.text("Edit", "Изменить")) {
                    activeSheet = .editShift(shift, shift.date)
                }
                Button(languageManager.text("Delete", "Удалить"), role: .destructive) {
                    Task { await viewModel.deleteShift(shift) }
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }
        }
        .padding(12)
        .background(themeManager.selectedTheme.cardTint)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func unfilledRow(_ requirement: AppUnfilledRequirement) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(ManagerScheduleViewModel.minutesToDisplay(requirement.startMinutes)) – \(ManagerScheduleViewModel.minutesToDisplay(requirement.endMinutes))")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                Text(requirement.positionTitle)
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                Text(languageManager.text("Need \(requirement.missingStaff) more", "Не хватает: \(requirement.missingStaff)"))
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(.orange)
            }
            Spacer()
            Button {
                activeSheet = .assignRequirement(requirement)
            } label: {
                Text(languageManager.text("Assign", "Назначить"))
                    .font(.footnote.weight(.semibold))
            }
            .buttonStyle(.plain)
            .themeCompactSecondaryAction()
        }
        .padding(12)
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.orange.opacity(0.4), lineWidth: 1)
        }
    }

    // MARK: - Actions

    private var actionButtons: some View {
        VStack(spacing: 12) {
            if let status = viewModel.statusMessage {
                Text(status)
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }
        }
        .padding(.top, 4)
    }

    // MARK: - Sheets

    @ViewBuilder
    private func sheetContent(_ sheet: ScheduleSheet) -> some View {
        switch sheet {
        case .generate:
            GenerateScheduleSheet(viewModel: viewModel)
        case let .editShift(shift, day):
            ShiftEditorSheet(viewModel: viewModel, shift: shift, day: day)
        case let .assignShift(shift):
            AssignEmployeeSheet(viewModel: viewModel, target: .shift(shift))
        case let .assignRequirement(requirement):
            AssignEmployeeSheet(viewModel: viewModel, target: .requirement(requirement))
        }
    }

    // MARK: - Bindings & helpers

    private var conflictBinding: Binding<Bool> {
        Binding(
            get: { viewModel.conflict != nil },
            set: { if !$0 { viewModel.dismissConflict() } }
        )
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.clearMessages() } }
        )
    }

    private func conflictMessage(_ conflict: ScheduleConflict) -> String {
        let formatter = DateFormatter()
        formatter.locale = languageManager.locale
        formatter.dateFormat = "d MMM"
        let range = "\(formatter.string(from: conflict.startDate)) – \(formatter.string(from: conflict.endDate))"
        return languageManager.text(
            "\(conflict.status.title) schedule #\(conflict.scheduleId) (\(range)) overlaps this period. Open it, or delete it and generate a new one.",
            "\(conflict.status.title) №\(conflict.scheduleId) (\(range)) пересекается с этим периодом. Откройте его или удалите и создайте новое."
        )
    }

    private func dayTitle(_ day: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = languageManager.locale
        formatter.dateFormat = "EEEE, d MMM"
        return formatter.string(from: day)
    }
}

// MARK: - Sheet: generate

private struct GenerateScheduleSheet: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @Environment(\.dismiss) private var dismiss

    @ObservedObject var viewModel: ManagerScheduleViewModel

    @State private var selectedBranchId: Int? = nil
    @State private var weeks: Int = 1

    var body: some View {
        NavigationStack {
            Form {
                if viewModel.branches.count > 1 {
                    Section(languageManager.text("Branch", "Филиал")) {
                        Picker(languageManager.text("Branch", "Филиал"), selection: $selectedBranchId) {
                            Text(languageManager.text("Auto (by requirements)", "Авто (по требованиям)")).tag(Int?.none)
                            ForEach(viewModel.branches) { branch in
                                Text(branch.name).tag(Int?.some(branch.id))
                            }
                        }
                    }
                }

                Section(languageManager.text("Duration", "Длительность")) {
                    Picker(languageManager.text("Weeks", "Недель"), selection: $weeks) {
                        Text(languageManager.text("1 week", "1 неделя")).tag(1)
                        Text(languageManager.text("2 weeks", "2 недели")).tag(2)
                        Text(languageManager.text("4 weeks", "4 недели")).tag(4)
                    }
                    .pickerStyle(.segmented)

                    Text(periodLabel)
                        .font(.footnote)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }

                Section {
                    Button {
                        Task {
                            let start = viewModel.weekStart
                            let end = Calendar(identifier: .gregorian)
                                .date(byAdding: .day, value: weeks * 7 - 1, to: start) ?? start
                            await viewModel.generate(startDate: start, endDate: end, branchId: selectedBranchId)
                            // Always close the sheet: the parent surfaces the
                            // conflict dialog / error alert / new schedule.
                            dismiss()
                        }
                    } label: {
                        if viewModel.isGenerating {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text(languageManager.text("Generate", "Сгенерировать")).frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(viewModel.isGenerating)
                }
            }
            .navigationTitle(languageManager.text("Generate schedule", "Генерация расписания"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(languageManager.text("Cancel", "Отмена")) { dismiss() }
                }
            }
        }
    }

    private var periodLabel: String {
        let calendar = Calendar(identifier: .gregorian)
        let start = viewModel.weekStart
        let end = calendar.date(byAdding: .day, value: weeks * 7 - 1, to: start) ?? start
        let formatter = DateFormatter()
        formatter.locale = languageManager.locale
        formatter.dateFormat = "d MMM"
        return "\(formatter.string(from: start)) – \(formatter.string(from: end))"
    }
}

// MARK: - Sheet: create / edit shift

private struct ShiftEditorSheet: View {
    @EnvironmentObject private var languageManager: LanguageManager
    @Environment(\.dismiss) private var dismiss

    @ObservedObject var viewModel: ManagerScheduleViewModel

    let shift: AppScheduledShift?
    let day: Date

    @State private var positionId: Int?
    @State private var startMinutes: Int
    @State private var endMinutes: Int
    @State private var isSaving = false

    init(viewModel: ManagerScheduleViewModel, shift: AppScheduledShift?, day: Date) {
        self.viewModel = viewModel
        self.shift = shift
        self.day = day
        _positionId = State(initialValue: shift?.positionId)
        _startMinutes = State(initialValue: shift?.startMinutes ?? 8 * 60)
        _endMinutes = State(initialValue: shift?.endMinutes ?? 16 * 60)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(languageManager.text("Position", "Должность")) {
                    Picker(languageManager.text("Position", "Должность"), selection: $positionId) {
                        Text(languageManager.text("Select…", "Выбрать…")).tag(Int?.none)
                        ForEach(viewModel.positions) { position in
                            Text(position.name).tag(Int?.some(position.id))
                        }
                    }
                }

                Section(languageManager.text("Time", "Время")) {
                    Picker(languageManager.text("Start", "Начало"), selection: $startMinutes) {
                        ForEach(ManagerScheduleViewModel.minuteOptions, id: \.self) { minutes in
                            Text(ManagerScheduleViewModel.minutesToDisplay(minutes)).tag(minutes)
                        }
                    }
                    Picker(languageManager.text("End", "Конец"), selection: $endMinutes) {
                        ForEach(ManagerScheduleViewModel.minuteOptions, id: \.self) { minutes in
                            Text(ManagerScheduleViewModel.minutesToDisplay(minutes)).tag(minutes)
                        }
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
                    .disabled(isSaving || positionId == nil)
                }
            }
            .navigationTitle(shift == nil
                ? languageManager.text("New shift", "Новая смена")
                : languageManager.text("Edit shift", "Изменить смену"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(languageManager.text("Cancel", "Отмена")) { dismiss() }
                }
            }
        }
    }

    private func save() async {
        guard let positionId else { return }
        isSaving = true
        let success: Bool
        if let shift {
            // Preserve the current assignment when editing time/position.
            success = await viewModel.updateShift(
                shiftId: shift.id, date: day, positionId: positionId,
                startMinutes: startMinutes, endMinutes: endMinutes, employeeId: shift.employeeId
            )
        } else {
            success = await viewModel.createShift(
                date: day, positionId: positionId,
                startMinutes: startMinutes, endMinutes: endMinutes
            )
        }
        isSaving = false
        if success { dismiss() }
    }
}

// MARK: - Sheet: assign employee

private struct AssignEmployeeSheet: View {
    enum Target {
        case shift(AppScheduledShift)
        case requirement(AppUnfilledRequirement)
    }

    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @Environment(\.dismiss) private var dismiss

    @ObservedObject var viewModel: ManagerScheduleViewModel
    let target: Target

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.loadingEmployees {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.availableEmployees.isEmpty {
                    Text(languageManager.text("No employees found.", "Сотрудники не найдены."))
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(viewModel.availableEmployees) { employee in
                        Button {
                            Task { await assign(employee) }
                        } label: {
                            employeeRow(employee)
                        }
                    }
                }
            }
            .navigationTitle(languageManager.text("Assign employee", "Назначить сотрудника"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(languageManager.text("Cancel", "Отмена")) {
                        viewModel.clearAvailable()
                        dismiss()
                    }
                }
            }
        }
        .task {
            switch target {
            case let .shift(shift):
                await viewModel.loadAvailable(for: shift)
            case let .requirement(requirement):
                await viewModel.loadAvailable(for: requirement)
            }
        }
    }

    private func employeeRow(_ employee: AppAvailableEmployee) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(employee.fullName)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                HStack(spacing: 6) {
                    Text(employee.availabilityStatus.title)
                        .font(.caption)
                        .foregroundStyle(statusColor(employee.availabilityStatus))
                    if let branchName = employee.branchName {
                        Text("· \(branchName)")
                            .font(.caption)
                            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                    }
                    if viewModel.isCrossBranch(employee) {
                        Text(languageManager.text("· other branch", "· другой филиал"))
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                }
            }
            Spacer()
            Text(String(format: "%.1f h", employee.assignedHours))
                .font(.caption)
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
        }
    }

    private func statusColor(_ status: AppEmployeeAvailabilityStatus) -> Color {
        switch status {
        case .available: return .green
        case .ifNeeded: return .orange
        case .unavailable: return themeManager.selectedTheme.secondaryTextColor
        }
    }

    private func assign(_ employee: AppAvailableEmployee) async {
        switch target {
        case let .shift(shift):
            await viewModel.assignShift(shiftId: shift.id, employeeId: employee.id)
        case let .requirement(requirement):
            await viewModel.assignRequirement(requirementId: requirement.id, employeeId: employee.id)
        }
        if viewModel.errorMessage == nil {
            dismiss()
        }
    }
}

// MARK: - Sheet identity

private enum ScheduleSheet: Identifiable {
    case generate
    case editShift(AppScheduledShift?, Date)
    case assignShift(AppScheduledShift)
    case assignRequirement(AppUnfilledRequirement)

    var id: String {
        switch self {
        case .generate:
            return "generate"
        case let .editShift(shift, day):
            return "edit-\(shift?.id ?? -1)-\(day.timeIntervalSince1970)"
        case let .assignShift(shift):
            return "assign-shift-\(shift.id)"
        case let .assignRequirement(requirement):
            return "assign-req-\(requirement.id)"
        }
    }
}
