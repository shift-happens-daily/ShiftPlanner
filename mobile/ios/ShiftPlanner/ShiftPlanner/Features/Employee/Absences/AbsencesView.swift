import SwiftUI

struct AbsencesView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    @StateObject private var viewModel: AbsencesViewModel

    @State private var isShowingCreateSheet = false

    init(user: AppUser) {
        _viewModel = StateObject(wrappedValue: AbsencesViewModel(user: user))
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 16) {
                    if viewModel.isLoading && !viewModel.hasAbsences {
                        ProgressView().padding(.top, 40)
                    } else if viewModel.hasAbsences {
                        ForEach(viewModel.absences) { absence in
                            absenceCard(absence)
                        }
                    } else {
                        Text(viewModel.statusMessage ?? languageManager.text(
                            "No absences yet. Add vacations or sick leaves so the schedule generator can plan around them.",
                            "Отсутствий пока нет. Добавьте отпуска и больничные, чтобы генератор расписания их учитывал."
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
            .navigationTitle(languageManager.text("Absences", "Отсутствия"))
            .navigationBarTitleDisplayMode(.inline)
            .refreshable { await viewModel.reload() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isShowingCreateSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .disabled(!viewModel.canManage)
                }
            }
            .task { await viewModel.loadIfNeeded() }
            .sheet(isPresented: $isShowingCreateSheet) {
                AbsenceCreateSheet(viewModel: viewModel)
                    .environmentObject(themeManager)
                    .environmentObject(languageManager)
            }
        }
    }

    private func absenceCard(_ absence: AppAbsence) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(absence.absenceType.title)
                    .font(.headline)
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                Spacer()

                if let status = absence.status {
                    Text(status.title)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(statusColor(status).opacity(0.15))
                        .foregroundStyle(statusColor(status))
                        .clipShape(Capsule())
                }

                Menu {
                    Button(languageManager.text("Delete", "Удалить"), role: .destructive) {
                        Task { await viewModel.deleteAbsence(absence) }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }
            }

            Text("\(AbsencesViewModel.displayDate(absence.startDate)) – \(AbsencesViewModel.displayDate(absence.endDate))")
                .font(.subheadline)
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

            if let comment = absence.comment, !comment.isEmpty {
                Text(comment)
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
            }
        }
        .padding(16)
        .themeCard()
    }

    private func statusColor(_ status: AppAbsenceStatus) -> Color {
        switch status {
        case .pending: return .orange
        case .approved: return .green
        case .rejected: return .red
        }
    }
}

// MARK: - Create sheet

private struct AbsenceCreateSheet: View {
    @EnvironmentObject private var languageManager: LanguageManager
    @Environment(\.dismiss) private var dismiss

    @ObservedObject var viewModel: AbsencesViewModel

    @State private var type: AppAbsenceType = .vacation
    @State private var startDate = Date()
    @State private var endDate = Date()
    @State private var comment = ""

    var body: some View {
        NavigationStack {
            Form {
                Section(languageManager.text("Type", "Тип")) {
                    Picker(languageManager.text("Type", "Тип"), selection: $type) {
                        ForEach(AppAbsenceType.allCases) { option in
                            Text(option.title).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section(languageManager.text("Dates", "Даты")) {
                    DatePicker(
                        languageManager.text("From", "С"),
                        selection: $startDate,
                        displayedComponents: .date
                    )
                    DatePicker(
                        languageManager.text("To", "По"),
                        selection: $endDate,
                        in: startDate...,
                        displayedComponents: .date
                    )
                }

                Section(languageManager.text("Comment (optional)", "Комментарий (необязательно)")) {
                    TextField(
                        languageManager.text("Comment", "Комментарий"),
                        text: $comment,
                        axis: .vertical
                    )
                    .lineLimit(2...4)
                }

                Section {
                    Button {
                        Task {
                            let success = await viewModel.createAbsence(
                                type: type,
                                startDate: startDate,
                                endDate: endDate,
                                comment: comment
                            )
                            if success { dismiss() }
                        }
                    } label: {
                        if viewModel.isSubmitting {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text(languageManager.text("Add absence", "Добавить отсутствие")).frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(viewModel.isSubmitting)
                }

                if let errorMessage = viewModel.errorMessage {
                    Section {
                        Text(errorMessage).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(languageManager.text("New absence", "Новое отсутствие"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(languageManager.text("Cancel", "Отмена")) { dismiss() }
                }
            }
        }
    }
}
