import Foundation
import Combine

@MainActor
final class AbsencesViewModel: ObservableObject {
    @Published private(set) var absences: [AppAbsence] = []
    @Published var isLoading = false
    @Published var isSubmitting = false
    @Published var errorMessage: String?
    @Published var statusMessage: String?

    private let repository: AbsenceRepository
    private let employeeId: Int?
    private var hasLoaded = false

    init(user: AppUser, repository: AbsenceRepository? = nil) {
        self.repository = repository ?? APIAbsenceRepository()
        self.employeeId = user.employeeId
    }

    var canManage: Bool { employeeId != nil }
    var hasAbsences: Bool { !absences.isEmpty }

    func loadIfNeeded() async {
        guard !hasLoaded else { return }
        hasLoaded = true
        await load()
    }

    func load() async {
        guard canManage else {
            statusMessage = localized(
                "Join a company first to manage absences.",
                "Сначала присоединитесь к компании, чтобы управлять отсутствиями."
            )
            return
        }
        isLoading = true
        errorMessage = nil
        do {
            absences = try await repository.fetchMyAbsences()
                .sorted { $0.startDate > $1.startDate }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func reload() async {
        hasLoaded = false
        await loadIfNeeded()
    }

    func createAbsence(type: AppAbsenceType, startDate: Date, endDate: Date, comment: String) async -> Bool {
        guard endDate >= startDate else {
            errorMessage = localized("End date must not be before start date.", "Дата окончания не может быть раньше начала.")
            return false
        }
        isSubmitting = true
        errorMessage = nil
        do {
            _ = try await repository.createMyAbsence(
                type: type,
                startDate: Self.apiDate(startDate),
                endDate: Self.apiDate(endDate),
                comment: comment.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : comment
            )
            statusMessage = localized("Absence added.", "Отсутствие добавлено.")
            isSubmitting = false
            await load()
            return true
        } catch {
            errorMessage = error.localizedDescription
            isSubmitting = false
            return false
        }
    }

    func deleteAbsence(_ absence: AppAbsence) async {
        guard let employeeId else { return }
        do {
            try await repository.deleteAbsence(employeeId: employeeId, absenceId: absence.id)
            absences.removeAll { $0.id == absence.id }
            statusMessage = localized("Absence removed.", "Отсутствие удалено.")
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func clearMessages() {
        errorMessage = nil
        statusMessage = nil
    }

    static func apiDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    static func displayDate(_ apiDate: String) -> String {
        let parser = DateFormatter()
        parser.calendar = Calendar(identifier: .gregorian)
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.dateFormat = "yyyy-MM-dd"
        guard let date = parser.date(from: apiDate) else { return apiDate }

        let formatter = DateFormatter()
        formatter.locale = LanguageManager.storedLocale
        formatter.dateFormat = "d MMM yyyy"
        return formatter.string(from: date)
    }
}
