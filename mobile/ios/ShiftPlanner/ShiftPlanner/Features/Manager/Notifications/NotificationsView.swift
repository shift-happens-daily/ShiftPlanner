import SwiftUI

struct NotificationsView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: NotificationsViewModel

    init(companyId: Int?) {
        _viewModel = StateObject(wrappedValue: NotificationsViewModel(companyId: companyId))
    }

    var body: some View {
        NavigationStack {
            List {
                exchangeSection
                timeOffSection
                employeeSection
                managerSection

                if let errorMessage = viewModel.errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(themeManager.selectedTheme.destructiveColor)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(themeManager.selectedTheme.screenBackground)
            .navigationTitle(localized("Notifications", "Уведомления"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(localized("Close", "Закрыть")) { dismiss() }
                }
            }
            .overlay {
                if viewModel.isLoading && viewModel.totalCount == 0 {
                    ProgressView()
                }
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
        }
    }

    // MARK: - Sections

    private var exchangeSection: some View {
        Section(localized("Shift exchange", "Обмен сменами")) {
            if viewModel.exchangeRequests.isEmpty {
                emptyRow(localized("No exchange requests.", "Нет запросов на обмен."))
            } else {
                ForEach(viewModel.exchangeRequests) { request in
                    requestRow(
                        title: request.employeeName,
                        subtitle: request.note,
                        acceptLabel: localized("Approve", "Одобрить"),
                        declineLabel: localized("Reject", "Отклонить"),
                        onAccept: { Task { await viewModel.approveExchange(request) } },
                        onDecline: { Task { await viewModel.rejectExchange(request) } }
                    )
                }
            }
        }
    }

    private var timeOffSection: some View {
        Section(localized("Time off", "Отгулы")) {
            emptyRow(localized(
                "No time-off requests.",
                "Нет запросов на отгулы."
            ))
        }
    }

    private var employeeSection: some View {
        Section(localized("New employees", "Новые сотрудники")) {
            if viewModel.employeeRequests.isEmpty {
                emptyRow(localized("No pending employees.", "Нет заявок от сотрудников."))
            } else {
                ForEach(viewModel.employeeRequests) { request in
                    requestRow(
                        title: request.fullName,
                        subtitle: request.email,
                        acceptLabel: localized("Accept", "Принять"),
                        declineLabel: localized("Decline", "Отклонить"),
                        onAccept: { Task { await viewModel.acceptEmployee(request) } },
                        onDecline: { Task { await viewModel.declineEmployee(request) } }
                    )
                }
            }
        }
    }

    private var managerSection: some View {
        Section(localized("Managers", "Менеджеры")) {
            if viewModel.managerRequests.isEmpty {
                emptyRow(localized("No pending managers.", "Нет заявок от менеджеров."))
            } else {
                ForEach(viewModel.managerRequests) { request in
                    requestRow(
                        title: request.fullName,
                        subtitle: request.email,
                        acceptLabel: localized("Accept", "Принять"),
                        declineLabel: localized("Decline", "Отклонить"),
                        onAccept: { Task { await viewModel.acceptManager(request) } },
                        onDecline: { Task { await viewModel.declineManager(request) } }
                    )
                }
            }
        }
    }

    // MARK: - Rows

    private func emptyRow(_ text: String) -> some View {
        Text(text)
            .font(.footnote)
            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
    }

    private func requestRow(
        title: String,
        subtitle: String,
        acceptLabel: String,
        declineLabel: String,
        onAccept: @escaping () -> Void,
        onDecline: @escaping () -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            if !subtitle.isEmpty {
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }

            HStack(spacing: 10) {
                Button(acceptLabel, action: onAccept)
                    .buttonStyle(.plain)
                    .themeCompactSecondaryAction()
                Button(declineLabel, action: onDecline)
                    .buttonStyle(.plain)
                    .themeCompactDestructiveAction()
                Spacer()
            }
        }
        .padding(.vertical, 4)
    }
}
