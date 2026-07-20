import SwiftUI

struct EmployeeScheduleView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel: EmployeeScheduleViewModel
    @State private var exchangeShift: AppScheduledShift?
    @State private var isShowingNotifications = false
    private let user: AppUser

    init(user: AppUser) {
        self.user = user
        _viewModel = StateObject(wrappedValue: EmployeeScheduleViewModel(user: user))
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 16) {
                    if viewModel.isLoading && !viewModel.hasShifts {
                        ProgressView().padding(.top, 40)
                    } else if viewModel.hasShifts {
                        ScheduleCalendarSectionView(
                            items: viewModel.shifts,
                            sectionTitle: languageManager.text("My shifts", "Мои смены"),
                            dateProvider: { $0.date },
                            rowContent: { shift in shiftRow(shift) }
                        )
                    } else {
                        Text(viewModel.statusMessage ?? languageManager.text(
                            "No published shifts yet.",
                            "Опубликованных смен пока нет."
                        ))
                        .font(.footnote)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 24)
                    }

                    if let errorMessage = viewModel.errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding()
            }
            .background(themeManager.selectedTheme.screenBackground)
            .navigationTitle(languageManager.text("Schedule", "Расписание"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isShowingNotifications = true
                    } label: {
                        Image(systemName: "bell")
                    }
                    .accessibilityLabel(localized("Notifications", "Уведомления"))
                }
            }
            .sheet(isPresented: $isShowingNotifications) {
                EmployeeNotificationsView(companyName: user.company?.name)
                    .environmentObject(themeManager)
                    .environmentObject(languageManager)
            }
            .task { await viewModel.loadScheduleIfNeeded() }
            .sheet(item: $exchangeShift) { shift in
                RequestExchangeSheet(
                    shift: shift,
                    viewModel: viewModel,
                    onClose: { exchangeShift = nil }
                )
                .environmentObject(themeManager)
                .environmentObject(languageManager)
            }
            .alert(
                languageManager.text("Request sent", "Запрос отправлен"),
                isPresented: Binding(
                    get: { viewModel.exchangeMessage != nil },
                    set: { if !$0 { viewModel.exchangeMessage = nil } }
                ),
                presenting: viewModel.exchangeMessage
            ) { _ in
                Button("OK", role: .cancel) { viewModel.exchangeMessage = nil }
            } message: { message in
                Text(message)
            }
        }
    }

    private func shiftRow(_ shift: AppScheduledShift) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(minutes(shift.startMinutes)) – \(minutes(shift.endMinutes))")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                Text(shift.positionName)
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }
            Spacer()
            Image(systemName: "arrow.left.arrow.right")
                .font(.footnote)
                .foregroundStyle(themeManager.selectedTheme.accentColor)
        }
        .padding(12)
        .background(themeManager.selectedTheme.cardTint)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .onTapGesture { exchangeShift = shift }
    }

    private func minutes(_ value: Int) -> String {
        String(format: "%02d:%02d", value / 60, value % 60)
    }
}

// MARK: - Request exchange sheet

private struct RequestExchangeSheet: View {
    @EnvironmentObject private var languageManager: LanguageManager
    @EnvironmentObject private var themeManager: ThemeManager

    let shift: AppScheduledShift
    @ObservedObject var viewModel: EmployeeScheduleViewModel
    let onClose: () -> Void

    @State private var note = ""
    @State private var isSending = false

    var body: some View {
        NavigationStack {
            Form {
                Section(languageManager.text("Shift", "Смена")) {
                    Text("\(Self.dateLabel(shift.date, locale: languageManager.locale)) · \(Self.time(shift.startMinutes)) – \(Self.time(shift.endMinutes))")
                        .font(.subheadline.weight(.semibold))
                    Text(shift.positionName)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }

                Section(languageManager.text("Reason", "Причина")) {
                    TextField(
                        languageManager.text("Why do you want to swap this shift?", "Почему хотите поменять смену?"),
                        text: $note
                    )
                }

                Section {
                    Button {
                        Task {
                            isSending = true
                            await viewModel.requestExchange(
                                shiftId: shift.id,
                                note: note.trimmingCharacters(in: .whitespacesAndNewlines)
                            )
                            isSending = false
                            onClose()
                        }
                    } label: {
                        if isSending {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text(languageManager.text("Send request", "Отправить запрос"))
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(isSending || note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .navigationTitle(languageManager.text("Request exchange", "Запрос на обмен"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(languageManager.text("Cancel", "Отмена")) { onClose() }
                }
            }
        }
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
